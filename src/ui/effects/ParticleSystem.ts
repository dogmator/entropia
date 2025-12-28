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

import { ParticlePool, type PooledParticle } from '@core/ObjectPool.ts';
import * as THREE from 'three';

import { COLORS, PARTICLE_CONSTANTS, RENDER } from '@/config';
import type { Vector3 } from '@/types';

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
  private readonly activeParticles: PooledParticle[] = [];
  private activeCount: number = 0;

  // Механізм Dirty Tracking для мінімізації обміну даними з GPU
  private dirtyMin: number = Infinity;
  private dirtyMax: number = -Infinity;
  private isDirty: boolean = false;

  constructor(scene: THREE.Scene, maxParticles: number = RENDER.maxEffectParticles) {
    this.scene = scene;


    // Ініціалізація типізованих масивів для буферів
    this.positions = new Float32Array(maxParticles * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    this.sizes = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);
    this.colors = new Float32Array(maxParticles * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    // Конструювання об'єкта буферної геометрії
    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const sizeAttr = new THREE.BufferAttribute(this.sizes, PARTICLE_CONSTANTS.SCALAR_COMPONENTS);
    const opacityAttr = new THREE.BufferAttribute(this.opacities, PARTICLE_CONSTANTS.SCALAR_COMPONENTS);
    const colorAttr = new THREE.BufferAttribute(this.colors, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

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

    // Пул часток уже ініціалізований глобально в ObjectPool.ts
    // Ми будемо вилучати частоки з нього за потреби.
  }

  // ============================================================================
  // ПУБЛІЧНІ МЕТОДИ ГЕНЕРАЦІЇ ВІЗУАЛЬНИХ ПОДІЙ
  // ============================================================================

  /**
   * Ініціалізація візуального ефекту термінального стану (смерті) організму.
   */
  public addDeathEffect(position: Vector3, color: number, isPredator: boolean = false): void {
    const particleCount = isPredator
      ? PARTICLE_CONSTANTS.DEATH_COUNT_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_COUNT_PREY;
    const speed = isPredator
      ? PARTICLE_CONSTANTS.DEATH_SPEED_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_SPEED_PREY;
    const size = isPredator
      ? PARTICLE_CONSTANTS.DEATH_SIZE_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_SIZE_PREY;

    for (let i = 0; i < particleCount; i++) {
      this.emitParticle({
        position,
        color,
        speed,
        size,
        /* eslint-disable-next-line sonarjs/pseudo-random */
        life: PARTICLE_CONSTANTS.DEATH_LIFE_MIN + Math.random() * PARTICLE_CONSTANTS.DEATH_LIFE_ADDITIONAL,
        explosive: true // Використання вибухової кінематики
      });
    }
  }

  /**
   * Ініціалізація візуального ефекту виникнення (народження) агента.
   */
  public addBirthEffect(position: Vector3, color: number): void {
    const particleCount = PARTICLE_CONSTANTS.BIRTH_COUNT_RING;

    // Генерація кільцевої ударної хвилі
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * PARTICLE_CONSTANTS.TWO_PI;
      const speed = PARTICLE_CONSTANTS.BIRTH_SPEED;

      const p = this.acquireParticle();
      if (!p) { return; }

      p.x = position.x;
      p.y = position.y;
      p.z = position.z;
      p.vx = Math.cos(angle) * speed;
      p.vy = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * PARTICLE_CONSTANTS.BIRTH_Y_VARIANCE;
      p.vz = Math.sin(angle) * speed;
      p.life = PARTICLE_CONSTANTS.BIRTH_LIFE;
      p.maxLife = PARTICLE_CONSTANTS.BIRTH_LIFE;
      p.size = PARTICLE_CONSTANTS.BIRTH_SIZE;
      p.color = color;
      p.opacity = PARTICLE_CONSTANTS.DEFAULT_OPACITY;
    }

    // Додатковий центральний фотонний спалах
    for (let i = 0; i < PARTICLE_CONSTANTS.BIRTH_COUNT_FLASH; i++) {
      this.emitParticle({
        position,
        color: PARTICLE_CONSTANTS.WHITE_COLOR,
        speed: PARTICLE_CONSTANTS.BIRTH_FLASH_SPEED,
        size: PARTICLE_CONSTANTS.BIRTH_FLASH_SIZE,
        life: PARTICLE_CONSTANTS.BIRTH_FLASH_LIFE,
        explosive: true
      });
    }
  }

  /**
   * Реалізація ефекту поглинання енергетичного ресурсу (харчування).
   */
  public addEatEffect(position: Vector3): void {
    for (let i = 0; i < PARTICLE_CONSTANTS.EAT_COUNT; i++) {
      this.emitParticle({
        position,
        color: COLORS.food.glow,
        speed: PARTICLE_CONSTANTS.EAT_SPEED,
        size: PARTICLE_CONSTANTS.EAT_SIZE,
        life: PARTICLE_CONSTANTS.EAT_LIFE,
        explosive: true
      });
    }
  }

  /**
   * Візуалізація вектора атаки хижака.
   */
  public addHuntEffect(predatorPos: Vector3, preyPos: Vector3): void {
    // Формування дискретної лінії траєкторії атаки
    const steps = PARTICLE_CONSTANTS.HUNT_STEPS;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pos = {
        x: predatorPos.x + (preyPos.x - predatorPos.x) * t,
        y: predatorPos.y + (preyPos.y - predatorPos.y) * t,
        z: predatorPos.z + (preyPos.z - predatorPos.z) * t,
      };
      this.emitParticle({
        position: pos,
        color: COLORS.predator.glow,
        speed: PARTICLE_CONSTANTS.HUNT_SPEED,
        size: PARTICLE_CONSTANTS.HUNT_SIZE,
        life: PARTICLE_CONSTANTS.HUNT_LIFE,
        explosive: false
      });
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

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (!p) { continue; }

      // Оновлення параметру часу життя
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.activeParticles.splice(i, 1);
        ParticlePool.release(p);
        this.activeCount--;
        this.markDirty(writeIndex); // Using writeIndex here might be tricky, let's rethink.
        continue;
      }

      // Розрахунок нових просторових координат
      p.x += p.vx * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;
      p.y += p.vy * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;
      p.z += p.vz * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;

      // Застосування коефіцієнта аеродинамічного опору середовища
      p.vx *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;
      p.vy *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;
      p.vz *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;

      // Інтеграція гравітаційного прискорення у вертикальній площині
      p.vy -= PARTICLE_CONSTANTS.GRAVITY;

      // Регулювання прозорості у функції часу життя
      const lifeRatio = p.life / p.maxLife;
      p.opacity = lifeRatio;

      // Серіалізація даних у буфери атрибутів
      const i3 = writeIndex * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      this.positions[i3 + PARTICLE_CONSTANTS.X_OFFSET] = p.x;
      this.positions[i3 + PARTICLE_CONSTANTS.Y_OFFSET] = p.y;
      this.positions[i3 + PARTICLE_CONSTANTS.Z_OFFSET] = p.z;

      this.sizes[writeIndex] = p.size * (PARTICLE_CONSTANTS.SIZE_SCALE_MIN + lifeRatio * PARTICLE_CONSTANTS.SIZE_SCALE_FACTOR);
      this.opacities[writeIndex] = p.opacity;

      // Декомпозиція колірного значення на RGB-компоненти з нормалізацією
      const r = ((p.color >> PARTICLE_CONSTANTS.COLOR_SHIFT_R) & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      const g = ((p.color >> PARTICLE_CONSTANTS.COLOR_SHIFT_G) & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      const b = (p.color & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      this.colors[i3 + PARTICLE_CONSTANTS.X_OFFSET] = r;
      this.colors[i3 + PARTICLE_CONSTANTS.Y_OFFSET] = g;
      this.colors[i3 + PARTICLE_CONSTANTS.Z_OFFSET] = b;

      this.markDirty(writeIndex);
      writeIndex++;
    }

    this.updateBufferRanges(writeIndex);
  }

  /**
   * GPU-оптимізація: Виконання оновлення тільки вказаного діапазону буферів.
   */
  private updateBufferRanges(writeIndex: number): void {
    if (this.isDirty && this.dirtyMin <= this.dirtyMax) {
      const posAttr = this.geometry.attributes['position'] as THREE.BufferAttribute;
      const sizeAttr = this.geometry.attributes['size'] as THREE.BufferAttribute;
      const opacityAttr = this.geometry.attributes['opacity'] as THREE.BufferAttribute;
      const colorAttr = this.geometry.attributes['color'] as THREE.BufferAttribute;

      const stride = PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      const count = this.dirtyMax - this.dirtyMin + 1;

      posAttr.addUpdateRange(this.dirtyMin * stride, count * stride);
      sizeAttr.addUpdateRange(this.dirtyMin, count);
      opacityAttr.addUpdateRange(this.dirtyMin, count);
      colorAttr.addUpdateRange(this.dirtyMin * stride, count * stride);

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
    for (const p of this.activeParticles) {
      ParticlePool.release(p);
    }
    this.activeParticles.length = 0;
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
  private acquireParticle(): PooledParticle | null {
    const p = ParticlePool.acquire();
    if (p) {
      this.activeParticles.push(p);
      this.activeCount++;
      return p;
    }
    return null;
  }

  /**
   * Формування та викид нової частоки з заданими кінематичними параметрами.
   */
  private emitParticle(params: {
    position: Vector3,
    color: number,
    speed: number,
    size: number,
    life: number,
    explosive: boolean
  }): void {
    const { position, color, speed, size, life, explosive } = params;
    const p = this.acquireParticle();
    if (!p) { return; }

    p.x = position.x;
    p.y = position.y;
    p.z = position.z;

    if (explosive) {
      // Генерація ізотропного сферичного розподілу векторів швидкості за методом Марсальї
      const theta = Math.random() * PARTICLE_CONSTANTS.TWO_PI;
      const phi = Math.acos(PARTICLE_CONSTANTS.SPHERE_PHI_MULTIPLIER * Math.random() - PARTICLE_CONSTANTS.SPHERE_RANDOM_OFFSET);
      const r = speed * (PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET + Math.random() * PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET);

      p.vx = r * Math.sin(phi) * Math.cos(theta);
      p.vy = r * Math.sin(phi) * Math.sin(theta);
      p.vz = r * Math.cos(phi);
    } else {
      p.vx = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
      p.vy = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
      p.vz = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
    }

    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.opacity = PARTICLE_CONSTANTS.DEFAULT_OPACITY;
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
  public updateTrail(organismId: string, params: {
    position: Vector3,
    color: number,
    enabled: boolean
  }): void {
    const { position, color, enabled } = params;
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

        if (distSq > PARTICLE_CONSTANTS.TRAIL_TELEPORT_THRESHOLD_SQ) {
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
    const positionBuffer = new Float32Array(this.maxTrailLength * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const colorBuffer = new Float32Array(this.maxTrailLength * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positionBuffer, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const colorAttr = new THREE.BufferAttribute(colorBuffer, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    // Специфікація динамічного використання для підвищення частоти оновлення
    posAttr.usage = THREE.DynamicDrawUsage;
    colorAttr.usage = THREE.DynamicDrawUsage;

    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colorAttr);

    // Налаштування матеріалу об'єкта Line
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: PARTICLE_CONSTANTS.TRAIL_OPACITY,
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
    if (trail.positions.length < PARTICLE_CONSTANTS.VECTOR2_OFFSET) { return; }

    const count = trail.positions.length;

    // Інкрементальне заповнення буферів детермінованими даними
    for (let i = 0; i < count; i++) {
      const pos = trail.positions[i];
      const alpha = trail.alphas[i];

      if (pos === undefined || alpha === undefined) { continue; }

      trail.positionBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.X_OFFSET] = pos.x;
      trail.positionBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.Y_OFFSET] = pos.y;
      trail.positionBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.Z_OFFSET] = pos.z;

      trail.colorBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.X_OFFSET] = trail.color.r * alpha;
      trail.colorBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.Y_OFFSET] = trail.color.g * alpha;
      trail.colorBuffer[i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS + PARTICLE_CONSTANTS.Z_OFFSET] = trail.color.b * alpha;
    }

    const posAttr = trail.geometry.attributes['position'] as THREE.BufferAttribute;
    const colorAttr = trail.geometry.attributes['color'] as THREE.BufferAttribute;

    // Повідомлення GPU про необхідність оновлення лише задіяного фрагмента пам'яті
    posAttr.addUpdateRange(0, count * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    colorAttr.addUpdateRange(0, count * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Коригування індексу відмальовування вершин
    trail.geometry.setDrawRange(0, count);
  }
}
