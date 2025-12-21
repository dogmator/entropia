
/**
 * EVOSIM 3D — Система Частинок
 *
 * Високопродуктивна система частинок для:
 * - Ефектів смерті (вибух частинок)
 * - Ефектів народження (кільцева хвиля)
 * - Слідів організмів
 * - Атмосферних ефектів
 *
 * Використовує Object Pool для нульового GC
 */

import * as THREE from 'three';
import { ParticlePool, PooledParticle } from '../../core/ObjectPool';
import { Vector3 } from '../../types';
import { RENDER, COLORS } from '../../constants';
import {
  particleVertexShader,
  particleFragmentShader,
} from '../shaders/OrganismShader';

// ============================================================================
// ТИПИ
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
// ГОЛОВНИЙ КЛАС
// ============================================================================

/**
 * Менеджер системи частинок
 */
export class ParticleSystem {
  private readonly scene: THREE.Scene;
  private readonly maxParticles: number;

  // Геометрія та матеріал
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly points: THREE.Points;

  // Буфери атрибутів
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly opacities: Float32Array;
  private readonly colors: Float32Array;

  // Активні частинки
  private readonly particles: ActiveParticle[] = [];
  private activeCount: number = 0;

  // Черга ефектів
  private readonly effectQueue: ParticleEffect[] = [];

  constructor(scene: THREE.Scene, maxParticles: number = RENDER.maxEffectParticles) {
    this.scene = scene;
    this.maxParticles = maxParticles;

    // Ініціалізація буферів
    this.positions = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);
    this.colors = new Float32Array(maxParticles * 3);

    // Створення геометрії
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Матеріал з кастомним шейдером
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Створення Points
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // Ініціалізація пулу частинок
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
  // ПУБЛІЧНІ МЕТОДИ
  // ============================================================================

  /**
   * Додати ефект смерті
   */
  addDeathEffect(position: Vector3, color: number, isPredator: boolean = false): void {
    const particleCount = isPredator ? 40 : 25;
    const speed = isPredator ? 3 : 2;
    const size = isPredator ? 4 : 3;

    for (let i = 0; i < particleCount; i++) {
      this.emitParticle(
        position,
        color,
        speed,
        size,
        0.8 + Math.random() * 0.4, // life 0.8-1.2s
        true // explosive
      );
    }
  }

  /**
   * Додати ефект народження
   */
  addBirthEffect(position: Vector3, color: number): void {
    const particleCount = 30;

    // Кільцева хвиля
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2;

      const p = this.acquireParticle();
      if (!p) return;

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

    // Центральний спалах
    for (let i = 0; i < 10; i++) {
      this.emitParticle(position, 0xffffff, 1, 5, 0.3, true);
    }
  }

  /**
   * Додати ефект поїдання
   */
  addEatEffect(position: Vector3): void {
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
   * Додати ефект полювання
   */
  addHuntEffect(predatorPos: Vector3, preyPos: Vector3): void {
    // Лінія атаки
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
   * Оновити систему частинок
   */
  update(deltaTime: number): void {
    let writeIndex = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      // Оновлення життя
      p.life -= deltaTime;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      // Оновлення фізики
      p.x += p.vx * deltaTime * 60;
      p.y += p.vy * deltaTime * 60;
      p.z += p.vz * deltaTime * 60;

      // Затухання швидкості
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vz *= 0.98;

      // Гравітація (легка)
      p.vy -= 0.02;

      // Затухання прозорості
      const lifeRatio = p.life / p.maxLife;
      p.opacity = lifeRatio;

      // Запис у буфери
      const i3 = writeIndex * 3;
      this.positions[i3] = p.x;
      this.positions[i3 + 1] = p.y;
      this.positions[i3 + 2] = p.z;

      this.sizes[writeIndex] = p.size * (0.5 + lifeRatio * 0.5);
      this.opacities[writeIndex] = p.opacity;

      // Колір (RGB)
      const r = ((p.color >> 16) & 255) / 255;
      const g = ((p.color >> 8) & 255) / 255;
      const b = (p.color & 255) / 255;
      this.colors[i3] = r;
      this.colors[i3 + 1] = g;
      this.colors[i3 + 2] = b;

      writeIndex++;
    }

    // Оновлення буферів GPU
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Обмеження кількості відображуваних частинок
    this.geometry.setDrawRange(0, writeIndex);
  }

  /**
   * Очистити всі частинки
   */
  clear(): void {
    for (const p of this.particles) {
      p.active = false;
    }
    this.activeCount = 0;
  }

  /**
   * Знищити систему
   */
  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }

  // ============================================================================
  // ПРИВАТНІ МЕТОДИ
  // ============================================================================

  /**
   * Отримати вільну частинку
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
   * Випустити частинку
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
    if (!p) return;

    p.x = position.x;
    p.y = position.y;
    p.z = position.z;

    if (explosive) {
      // Сферичний розподіл
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
   * Отримати кількість активних частинок
   */
  get count(): number {
    return this.activeCount;
  }
}

// ============================================================================
// СИСТЕМА СЛІДІВ
// ============================================================================

/**
 * Слід окремого організму
 */
interface Trail {
  readonly organismId: string;
  readonly positions: THREE.Vector3[];
  readonly alphas: number[];
  readonly color: THREE.Color;
  line: THREE.Line | null;
  maxLength: number;
}

/**
 * Менеджер слідів організмів
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
   * Оновити слід організму
   */
  updateTrail(
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
      trail = {
        organismId,
        positions: [],
        alphas: [],
        color: new THREE.Color(color),
        line: null,
        maxLength: this.maxTrailLength,
      };
      this.trails.set(organismId, trail);
    }

    // Додати нову позицію
    trail.positions.push(new THREE.Vector3(position.x, position.y, position.z));
    trail.alphas.push(1.0);

    // Обмежити довжину
    if (trail.positions.length > trail.maxLength) {
      trail.positions.shift();
      trail.alphas.shift();
    }

    // Оновити альфи (затухання)
    for (let i = 0; i < trail.alphas.length; i++) {
      trail.alphas[i] = (i + 1) / trail.positions.length;
    }

    // Оновити або створити лінію
    this.updateTrailLine(trail);
  }

  /**
   * Видалити слід
   */
  removeTrail(organismId: string): void {
    const trail = this.trails.get(organismId);
    if (trail) {
      if (trail.line) {
        this.scene.remove(trail.line);
        trail.line.geometry.dispose();
        (trail.line.material as THREE.Material).dispose();
      }
      this.trails.delete(organismId);
    }
  }

  /**
   * Очистити всі сліди
   */
  clear(): void {
    this.trails.forEach((trail, id) => {
      this.removeTrail(id);
    });
  }

  /**
   * Знищити систему
   */
  dispose(): void {
    this.clear();
  }

  // ============================================================================
  // ПРИВАТНІ МЕТОДИ
  // ============================================================================

  private updateTrailLine(trail: Trail): void {
    if (trail.positions.length < 2) return;

    // Видалити стару лінію
    if (trail.line) {
      this.scene.remove(trail.line);
      trail.line.geometry.dispose();
    }

    // Створити нову геометрію
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(trail.positions.length * 3);
    const colors = new Float32Array(trail.positions.length * 3);

    for (let i = 0; i < trail.positions.length; i++) {
      const pos = trail.positions[i];
      const alpha = trail.alphas[i];

      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      colors[i * 3] = trail.color.r * alpha;
      colors[i * 3 + 1] = trail.color.g * alpha;
      colors[i * 3 + 2] = trail.color.b * alpha;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Матеріал
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    trail.line = new THREE.Line(geometry, material);
    this.scene.add(trail.line);
  }
}
