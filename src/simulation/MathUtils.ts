/**
 * Entropia 3D — Математичний апарат симуляції.
 *
 * Оптимізовані обчислювальні алгоритми для тривимірного середовища:
 * - Тороїдальна топологія (циклічне замикання простору).
 * - Векторна алгебра та операції над радіус-векторами.
 * - Алгоритми лінійної та нелінійної інтерполяції.
 */

import type { MutableVector3, Vector3 } from '@/types';

import { WORLD_SIZE } from '../config';

/**
 * Статичний клас-контейнер для математичних утиліт.
 */
export class MathUtils {
  /** Половина лінійного розміру світу (кешоване значення для оптимізації). */
  // private static readonly HALF_WORLD = WORLD_SIZE / 2; // unused

  // ============================================================================
  // ТОРОЇДАЛЬНА ГЕОМЕТРІЯ (TOROIDAL GEOMETRY)
  // ============================================================================

  /**
   * Приведення координати до циклічного діапазону [0, WORLD_SIZE).
   */
  static wrap(value: number, worldSize: number = WORLD_SIZE): number {
    return ((value % worldSize) + worldSize) % worldSize;
  }

  /**
   * Мутація вектора для відповідності тороїдальним межам простору.
   */
  static wrapVector(v: MutableVector3, worldSize: number = WORLD_SIZE): void {
    v.x = MathUtils.wrap(v.x, worldSize);
    v.y = MathUtils.wrap(v.y, worldSize);
    v.z = MathUtils.wrap(v.z, worldSize);
  }

  /**
   * Обчислення квадрата найкоротшої тороїдальної відстані між точками.
   */
  static toroidalDistanceSq(a: Vector3, b: Vector3, worldSize: number = WORLD_SIZE): number {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    let dz = Math.abs(a.z - b.z);

    const halfWorld = worldSize / 2;

    if (dx > halfWorld) { dx = worldSize - dx; }
    if (dy > halfWorld) { dy = worldSize - dy; }
    if (dz > halfWorld) { dz = worldSize - dz; }

    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Обчислення найкоротшої тороїдальної відстані (модуль вектора).
   */
  static toroidalDistance(a: Vector3, b: Vector3, worldSize: number = WORLD_SIZE): number {
    return Math.sqrt(MathUtils.toroidalDistanceSq(a, b, worldSize));
  }

  /**
   * Розрахунок найкоротшого різницевого вектора з урахуванням тороїдальної топології.
   */
  static toroidalVector(from: Vector3, to: Vector3, worldSize: number = WORLD_SIZE, target?: MutableVector3): MutableVector3 {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dz = to.z - from.z;

    const halfWorld = worldSize / 2;

    if (dx > halfWorld) { dx -= worldSize; }
    else if (dx < -halfWorld) { dx += worldSize; }

    if (dy > halfWorld) { dy -= worldSize; }
    else if (dy < -halfWorld) { dy += worldSize; }

    if (dz > halfWorld) { dz -= worldSize; }
    else if (dz < -halfWorld) { dz += worldSize; }

    if (target) {
      target.x = dx;
      target.y = dy;
      target.z = dz;
      return target;
    }
    return { x: dx, y: dy, z: dz };
  }

  // ============================================================================
  // ВЕКТОРНА АЛГЕБРА (VECTOR OPERATIONS)
  // ============================================================================

  /**
   * Нормалізація вектора (приведення до одиничної довжини).
   */
  static normalize(v: Vector3, target?: MutableVector3): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    const res = target || { x: 0, y: 0, z: 0 };

    if (magSq < 0.000001) {
      res.x = 0; res.y = 0; res.z = 0;
      return res;
    }

    const mag = Math.sqrt(magSq);
    res.x = v.x / mag;
    res.y = v.y / mag;
    res.z = v.z / mag;
    return res;
  }

  /**
   * Обмеження норми вектора заданим максимальним значенням (Clamping).
   */
  static limit(v: Vector3, max: number, target?: MutableVector3): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    const res = target || { x: 0, y: 0, z: 0 };

    if (magSq > max * max && magSq > 0) {
      const mag = Math.sqrt(magSq);
      const scale = max / mag;
      res.x = v.x * scale;
      res.y = v.y * scale;
      res.z = v.z * scale;
      return res;
    }

    res.x = v.x;
    res.y = v.y;
    res.z = v.z;
    return res;
  }

  /**
   * Обчислення евклідової норми (довжини) вектора.
   */
  static magnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Обчислення квадрата норми вектора (оптимізовано для порівнянь).
   */
  static magnitudeSq(v: Vector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /**
   * Скалярний добуток двох векторів.
   */
  static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * Векторний добуток двох векторів у тривимірному просторі.
   */
  static cross(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Арифметичне додавання двох векторів.
   */
  static add(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Арифметичне віднімання двох векторів.
   */
  static sub(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = a.z - b.z;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Масштабування вектора на скалярну величину.
   */
  static scale(v: Vector3, s: number, target?: MutableVector3): MutableVector3 {
    const x = v.x * s;
    const y = v.y * s;
    const z = v.z * s;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  // ============================================================================
  // АЛГОРИТМИ ІНТЕРПОЛЯЦІЇ (INTERPOLATION)
  // ============================================================================

  /**
   * Лінійна інтерполяція між двома скалярними величинами.
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Покомпонентна лінійна інтерполяція між двома векторами.
   */
  static lerpVector(a: Vector3, b: Vector3, t: number, target?: MutableVector3): MutableVector3 {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Плавна ермітова інтерполяція (Smoothstep).
   */
  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ============================================================================
  // ДОПОМІЖНІ ОБЧИСЛЕННЯ (HELPER FUNCTIONS)
  // ============================================================================

  /**
   * Обмеження значення в заданому закритому інтервалі [min, max].
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Лінійне відображення значення з одного числового діапазону в інший.
   */
  static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  /**
   * Генерація псевдовипадкового числа в заданому діапазоні.
   */
  static random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Генерація стохастичного вектора, рівномірно розподіленого всередині сфери заданого радіуса.
   */
  static randomInSphere(radius: number): MutableVector3 {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * radius;

    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    };
  }

  /**
   * Дзеркальне відбиття вектора відносно заданої нормалі поверхні.
   */
  static reflect(incident: Vector3, normal: Vector3): MutableVector3 {
    const dot = MathUtils.dot(incident, normal);
    return {
      x: incident.x - 2 * dot * normal.x,
      y: incident.y - 2 * dot * normal.y,
      z: incident.z - 2 * dot * normal.z,
    };
  }
}
