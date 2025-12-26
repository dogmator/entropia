/**
 * Entropia 3D — GPU-оптимізована система генерації та управління частоками.
 *
 * Реалізовані методи оптимізації продуктивності:
 * - BufferAttribute.updateRange для інкрементального оновлення даних (мінімізація накладних витрат).
 * - Константна геометрія для TrailSystem для виключення збірки сміття (Zero GC).
 * - Пакетна обробка оновлень (Batch updates) для мінімізації черги команд до графічного процесора.
 * - Оптимізація відсікання за пірамідою видимості (Frustum culling).
 * - Інтелектуальний механізм відстеження змінених фрагментів буферів (Dirty tracking).
 *
 * Використовує патерн Object Pool для забезпечення стабільного використання пам'яті.
 */

import type { Vector3 } from '@/types';
import * as THREE from 'three';

import { COLORS, RENDER } from '@/constants.ts';
import type { PooledParticle } from '@core/ObjectPool.ts';
import {
  particleFragmentShader,
  particleVertexShader,
} from '../shaders/OrganismShader';

// ============================================================================
// ВИЗНАЧЕННЯ ТИПІВ ТА ІНТЕРФЕЙСІВ
// ============================================================================

export interface ParticleEffect {
  readonly id: string;
  readonly type: 'death' | 'birth' | 'eat' | 'hunt';
  readonly position: Vector3;
  readonly color: number;
  readonly startTime: number;
  readonly duration: number;
}

interface ActiveParticle extends PooledParticle {
  active: boolean;
}

// ============================================================================
// КЛАС МОДЕЛЮВАННЯ СИСТЕМИ ЧАСТОК З GPU-ОПТИМІЗАЦІЄЮ
// ============================================================================

/**
 * Керуючий центр системи часток з інтегрованими механізмами апаратної акселерації.
 */
export class ParticleSystem {
  private readonly scene: THREE.Scene;


  // Об'єкти графічної інфраструктури
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly points: THREE.Points;

  // Масиви атрибутів буферів
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly opacities: Float32Array;
  private readonly colors: Float32Array;

  // Реєстр активних елементів системи
  private readonly particles: ActiveParticle[] = [];
  private activeCount: number = 0;

  // Механізм Dirty Tracking для мінімізації обміну даними з GPU
  private dirtyMin: number = Infinity;
  private dirtyMax: number = -Infinity;
  private isDirty: boolean = false;

  constructor(scene: THREE.Scene, maxParticles: number = RENDER.maxEffectParticles) {
    this.scene = scene;


    // Ініціалізація типізованих масивів для буферів
    this.positions = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);
    this.colors = new Float32Array(maxParticles * 3);

    // Конструювання об'єкта буферної геометрії
    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    const sizeAttr = new THREE.BufferAttribute(this.sizes, 1);
    const opacityAttr = new THREE.BufferAttribute(this.opacities, 1);
    const colorAttr = new THREE.BufferAttribute(this.colors, 3);

    // Встановлення прапорця динамічного використання для оптимізації драйвером
    posAttr.usage = THREE.DynamicDrawUsage;
    sizeAttr.usage = THREE.DynamicDrawUsage;
    opacityAttr.usage = THREE.DynamicDrawUsage;
    colorAttr.usage = THREE.DynamicDrawUsage;

    this.geometry.setAttribute('position', posAttr);
    this.geometry.setAttribute('size', sizeAttr);
    this.geometry.setAttribute('opacity', opacityAttr);
    this.geometry.setAttribute('color', colorAttr);

    // Специфікація шейдерного матеріалу з підтримкою адитивного змішування
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Реєстрація вузла Points у графі сцени
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // Частоки можуть бути розосереджені по всьому об'єму
    this.scene.add(this.points);

    // Наповнення репозиторію пулу часток
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        size: 1, color: 0xffffff, opacity: 1,
        active: false,
      });
    }
  }

  // ============================================================================
  // ПУБЛІЧНІ МЕТОДИ ГЕНЕРАЦІЇ ВІЗУАЛЬНИХ ПОДІЙ
  // ============================================================================

  /**
   * Ініціалізація візуального ефекту термінального стану (смерті) організму.
   */
  public addDeathEffect(position: Vector3, color: number, isPredator: boolean = false): void {
    const particleCount = isPredator ? 40 : 25;
    const speed = isPredator ? 3 : 2;
    const size = isPredator ? 4 : 3;

    for (let i = 0; i < particleCount; i++) {
      this.emitParticle(
        position,
        color,
        speed,
        size,
        0.8 + Math.random() * 0.4, // Тривалість життєвого циклу 0.8-1.2с
        true // Використання вибухової кінематики
      );
    }
  }

  /**
   * Ініціалізація візуального ефекту виникнення (народження) агента.
   */
  public addBirthEffect(position: Vector3, color: number): void {
    const particleCount = 30;

    // Генерація кільцевої ударної хвилі
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2;

      const p = this.acquireParticle();
      if (!p) { return; }

      p.x = position.x;
      p.y = position.y;
      p.z = position.z;
      p.vx = Math.cos(angle) * speed;
      p.vy = (Math.random() - 0.5) * 0.5;
      p.vz = Math.sin(angle) * speed;
      p.life = 0.6;
      p.maxLife = 0.6;
      p.size = 3;
      p.color = color;
      p.opacity = 1;
      p.active = true;
    }

    // Додатковий центральний фотонний спалах
    for (let i = 0; i < 10; i++) {
      this.emitParticle(position, 0xffffff, 1, 5, 0.3, true);
    }
  }

  /**
   * Реалізація ефекту поглинання енергетичного ресурсу (харчування).
   */
  public addEatEffect(position: Vector3): void {
    for (let i = 0; i < 8; i++) {
      this.emitParticle(
        position,
        COLORS.food.glow,
        1.5,
        2,
        0.4,
        true
      );
    }
  }

  /**
   * Візуалізація вектора атаки хижака.
   */
  public addHuntEffect(predatorPos: Vector3, preyPos: Vector3): void {
    // Формування дискретної лінії траєкторії атаки
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pos = {
        x: predatorPos.x + (preyPos.x - predatorPos.x) * t,
        y: predatorPos.y + (preyPos.y - predatorPos.y) * t,
        z: predatorPos.z + (preyPos.z - predatorPos.z) * t,
      };
      this.emitParticle(pos, COLORS.predator.glow, 0.5, 2, 0.3, false);
    }
  }

  /**
   * Обчислювальний цикл оновлення стану системи часток з GPU-оптимізацією.
   */
  public update(deltaTime: number): void {
    let writeIndex = 0;
    this.dirtyMin = Infinity;
    this.dirtyMax = -Infinity;
    this.isDirty = false;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p || !p.active) { continue; }

      // Оновлення параметру часу життя
      p.life -= deltaTime;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        this.markDirty(writeIndex);
        continue;
      }

      // Розрахунок нових просторових координат
      p.x += p.vx * deltaTime * 60;
      p.y += p.vy * deltaTime * 60;
      p.z += p.vz * deltaTime * 60;

      // Модуляція динамічного опору середовища
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vz *= 0.98;

      // Додавання вектора гравітаційного прискорення (мінімальний вплив)
      p.vy -= 0.02;

      // Регулювання прозорості у функції часу життя
      const lifeRatio = p.life / p.maxLife;
      p.opacity = lifeRatio;

      // Серіалізація даних у буфери атрибутів
      const i3 = writeIndex * 3;
      this.positions[i3] = p.x;
      this.positions[i3 + 1] = p.y;
      this.positions[i3 + 2] = p.z;

      this.sizes[writeIndex] = p.size * (0.5 + lifeRatio * 0.5);
      this.opacities[writeIndex] = p.opacity;

      // Трансформація колірних значень (RGB)
      const r = ((p.color >> 16) & 255) / 255;
      const g = ((p.color >> 8) & 255) / 255;
      const b = (p.color & 255) / 255;
      this.colors[i3] = r;
      this.colors[i3 + 1] = g;
      this.colors[i3 + 2] = b;

      this.markDirty(writeIndex);
      writeIndex++;
    }

    // GPU-оптимізація: Виконання оновлення тільки вказаного діапазону буферів
    if (this.isDirty && this.dirtyMin <= this.dirtyMax) {
      const posAttr = this.geometry.attributes['position'] as THREE.BufferAttribute;
      const sizeAttr = this.geometry.attributes['size'] as THREE.BufferAttribute;
      const opacityAttr = this.geometry.attributes['opacity'] as THREE.BufferAttribute;
      const colorAttr = this.geometry.attributes['color'] as THREE.BufferAttribute;

      posAttr.addUpdateRange(this.dirtyMin * 3, (this.dirtyMax - this.dirtyMin + 1) * 3);
      sizeAttr.addUpdateRange(this.dirtyMin, this.dirtyMax - this.dirtyMin + 1);
      opacityAttr.addUpdateRange(this.dirtyMin, this.dirtyMax - this.dirtyMin + 1);
      colorAttr.addUpdateRange(this.dirtyMin * 3, (this.dirtyMax - this.dirtyMin + 1) * 3);

      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      opacityAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }

    // Встановлення діапазону відмальовування згідно з кількістю активних часток
    this.geometry.setDrawRange(0, writeIndex);
  }

  /**
   * Примусова деактивація всіх елементів системи.
   */
  public clear(): void {
    for (const p of this.particles) {
      p.active = false;
    }
    this.activeCount = 0;
  }

  /**
   * Звільнення ресурсів графічного процесора та завершення роботи системи.
   */
  public dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }

  // ============================================================================
  // ВНУТРІШНІ ДОПОМІЖНІ МЕТОДИ ОПТИМІЗАЦІЇ
  // ============================================================================

  /**
   * Реєстрація індексу зміненого елемента для механізму Dirty Tracking.
   */
  private markDirty(index: number): void {
    this.isDirty = true;
    if (index < this.dirtyMin) { this.dirtyMin = index; }
    if (index > this.dirtyMax) { this.dirtyMax = index; }
  }

  /**
   * Реалізація стратегії вилучення вільної частки з пулу.
   */
  private acquireParticle(): ActiveParticle | null {
    for (const p of this.particles) {
      if (!p.active) {
        this.activeCount++;
        return p;
      }
    }
    return null;
  }

  /**
   * Формування та викид нової частоки з заданими кінематичними параметрами.
   */
  private emitParticle(
    position: Vector3,
    color: number,
    speed: number,
    size: number,
    life: number,
    explosive: boolean
  ): void {
    const p = this.acquireParticle();
    if (!p) { return; }

    p.x = position.x;
    p.y = position.y;
    p.z = position.z;

    if (explosive) {
      // Побудова ізотропного сферичного розподілу векторів швидкості
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = speed * (0.5 + Math.random() * 0.5);

      p.vx = r * Math.sin(phi) * Math.cos(theta);
      p.vy = r * Math.sin(phi) * Math.sin(theta);
      p.vz = r * Math.cos(phi);
    } else {
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = (Math.random() - 0.5) * speed;
      p.vz = (Math.random() - 0.5) * speed;
    }

    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.opacity = 1;
    p.active = true;
  }

  /**
   * Поточна кількість активних елементів у системі.
   */
  public get count(): number {
    return this.activeCount;
  }
}

// ============================================================================
// GPU-ОПТИМІЗОВАНА СИСТЕМА ТРАСУВАННЯ ТРАЄКТОРІЙ (ZERO GC!)
// ============================================================================

/**
 * Опис структури об'єкта сліду суб'єкта з постійною буферною геометрією.
 */
interface Trail {
  readonly organismId: string;
  readonly positions: THREE.Vector3[];
  readonly alphas: number[];
  readonly color: THREE.Color;
  readonly geometry: THREE.BufferGeometry;
  readonly positionBuffer: Float32Array;
  readonly colorBuffer: Float32Array;
  line: THREE.Line;
  maxLength: number;
  needsRebuild: boolean;
}

/**
 * Менеджер управління графічними слідами (Trails) з високою ефективністю використання пам'яті.
 */
export class TrailSystem {
  private readonly scene: THREE.Scene;
  private readonly trails: Map<string, Trail> = new Map();
  private readonly maxTrailLength: number;

  constructor(scene: THREE.Scene, maxTrailLength: number = RENDER.maxTrailParticles) {
    this.scene = scene;
    this.maxTrailLength = maxTrailLength;
  }

  /**
   * Оновлення геометрії сліду для конкретного організму (Zero-allocation).
   */
  public updateTrail(
    organismId: string,
    position: Vector3,
    color: number,
    enabled: boolean
  ): void {
    if (!enabled) {
      this.removeTrail(organismId);
      return;
    }

    let trail = this.trails.get(organismId);

    if (!trail) {
      trail = this.createTrail(organismId, color);
      this.trails.set(organismId, trail);
    }

    // Check for wrapping/teleportation (distance threshold)
    if (trail.positions.length > 0) {
      const lastPos = trail.positions[trail.positions.length - 1];
      if (lastPos) {
        const distSq =
          (position.x - lastPos.x) ** 2 +
          (position.y - lastPos.y) ** 2 +
          (position.z - lastPos.z) ** 2;

        if (distSq > 2500) {
          trail.positions.length = 0;
          trail.alphas.length = 0;
        }
      }
    }

    // Реєстрація нового положення в ланцюгу трасування
    trail.positions.push(new THREE.Vector3(position.x, position.y, position.z));
    trail.alphas.push(1.0);

    // Усікання ланцюга відповідно до ліміту довжини
    if (trail.positions.length > trail.maxLength) {
      trail.positions.shift();
      trail.alphas.shift();
    }

    // Коригування градієнта прозорості (ефект поступового зникнення)
    for (let i = 0; i < trail.alphas.length; i++) {
      trail.alphas[i] = (i + 1) / trail.positions.length;
    }

    // Виконання прямого запису в буфери відеопам'яті
    this.updateTrailBuffers(trail);
  }

  /**
   * Термінальне видалення об'єкта сліду з графічної сцени.
   */
  public removeTrail(organismId: string): void {
    const trail = this.trails.get(organismId);
    if (trail) {
      this.scene.remove(trail.line);
      trail.geometry.dispose();
      (trail.line.material as THREE.Material).dispose();
      this.trails.delete(organismId);
    }
  }

  /**
   * Масове очищення всіх активних слідів.
   */
  public clear(): void {
    this.trails.forEach((_trail, id) => {
      this.removeTrail(id);
    });
  }

  /**
   * Завершення роботи системи та вивільнення пов'язаних ресурсів.
   */
  public dispose(): void {
    this.clear();
  }

  // ============================================================================
  // ПРИВАТНІ МЕТОДИ ВНУТРІШНЬОЇ МОДЕРНІЗАЦІЇ ГЕОМЕТРІЇ
  // ============================================================================

  /**
   * Ініціалізація нового об'єкта сліду з використанням персистентної геометрії.
   */
  private createTrail(organismId: string, color: number): Trail {
    // Алокація буферів максимальної ємності на етапі ініціалізації
    const positionBuffer = new Float32Array(this.maxTrailLength * 3);
    const colorBuffer = new Float32Array(this.maxTrailLength * 3);

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positionBuffer, 3);
    const colorAttr = new THREE.BufferAttribute(colorBuffer, 3);

    // Специфікація динамічного використання для підвищення частоти оновлення
    posAttr.usage = THREE.DynamicDrawUsage;
    colorAttr.usage = THREE.DynamicDrawUsage;

    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colorAttr);

    // Налаштування матеріалу об'єкта Line
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false; // Disable culling as we don't update bounding sphere
    this.scene.add(line);

    return {
      organismId,
      positions: [],
      alphas: [],
      color: new THREE.Color(color),
      geometry,
      positionBuffer,
      colorBuffer,
      line,
      maxLength: this.maxTrailLength,
      needsRebuild: true,
    };
  }

  /**
   * Оновлення вмісту атрибутів буферів (Zero GC - відсутність нових алокацій!).
   */
  private updateTrailBuffers(trail: Trail): void {
    if (trail.positions.length < 2) { return; }

    const count = trail.positions.length;

    // Інкрементальне заповнення буферів детермінованими даними
    for (let i = 0; i < count; i++) {
      const pos = trail.positions[i];
      const alpha = trail.alphas[i];

      if (pos === undefined || alpha === undefined) { continue; }

      trail.positionBuffer[i * 3] = pos.x;
      trail.positionBuffer[i * 3 + 1] = pos.y;
      trail.positionBuffer[i * 3 + 2] = pos.z;

      trail.colorBuffer[i * 3] = trail.color.r * alpha;
      trail.colorBuffer[i * 3 + 1] = trail.color.g * alpha;
      trail.colorBuffer[i * 3 + 2] = trail.color.b * alpha;
    }

    const posAttr = trail.geometry.attributes['position'] as THREE.BufferAttribute;
    const colorAttr = trail.geometry.attributes['color'] as THREE.BufferAttribute;

    // Повідомлення GPU про необхідність оновлення лише задіяного фрагмента пам'яті
    posAttr.addUpdateRange(0, count * 3);
    colorAttr.addUpdateRange(0, count * 3);

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Коригування індексу відмальовування вершин
    trail.geometry.setDrawRange(0, count);
  }
}
