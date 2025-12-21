
/**
 * EVOSIM 3D — Математичні Утиліти
 *
 * Оптимізовані математичні функції для 3D симуляції:
 * - Тороїдальна геометрія (обгортання світу)
 * - Векторні операції
 * - Інтерполяція та згладжування
 */

import { Vector3, MutableVector3 } from '../types';
import { WORLD_SIZE } from '../constants';

/**
 * Математичні утиліти для симуляції
 */
export class MathUtils {
  /** Половина розміру світу (кешовано) */
  private static readonly HALF_WORLD = WORLD_SIZE / 2;

  // ============================================================================
  // ТОРОЇДАЛЬНА ГЕОМЕТРІЯ
  // ============================================================================

  /**
   * Обгорнути координату в межах світу
   */
  static wrap(value: number): number {
    return ((value % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
  }

  /**
   * Обгорнути вектор у межах світу
   */
  static wrapVector(v: MutableVector3): void {
    v.x = MathUtils.wrap(v.x);
    v.y = MathUtils.wrap(v.y);
    v.z = MathUtils.wrap(v.z);
  }

  /**
   * Квадрат тороїдальної відстані між двома точками
   */
  static toroidalDistanceSq(a: Vector3, b: Vector3): number {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    let dz = Math.abs(a.z - b.z);

    if (dx > MathUtils.HALF_WORLD) dx = WORLD_SIZE - dx;
    if (dy > MathUtils.HALF_WORLD) dy = WORLD_SIZE - dy;
    if (dz > MathUtils.HALF_WORLD) dz = WORLD_SIZE - dz;

    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Тороїдальна відстань між двома точками
   */
  static toroidalDistance(a: Vector3, b: Vector3): number {
    return Math.sqrt(MathUtils.toroidalDistanceSq(a, b));
  }

  /**
   * Тороїдальний вектор від точки A до точки B
   */
  static toroidalVector(from: Vector3, to: Vector3): MutableVector3 {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dz = to.z - from.z;

    if (dx > MathUtils.HALF_WORLD) dx -= WORLD_SIZE;
    else if (dx < -MathUtils.HALF_WORLD) dx += WORLD_SIZE;

    if (dy > MathUtils.HALF_WORLD) dy -= WORLD_SIZE;
    else if (dy < -MathUtils.HALF_WORLD) dy += WORLD_SIZE;

    if (dz > MathUtils.HALF_WORLD) dz -= WORLD_SIZE;
    else if (dz < -MathUtils.HALF_WORLD) dz += WORLD_SIZE;

    return { x: dx, y: dy, z: dz };
  }

  // ============================================================================
  // ВЕКТОРНІ ОПЕРАЦІЇ
  // ============================================================================

  /**
   * Нормалізувати вектор
   */
  static normalize(v: Vector3): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq < 0.000001) return { x: 0, y: 0, z: 0 };
    const mag = Math.sqrt(magSq);
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }

  /**
   * Обмежити довжину вектора
   */
  static limit(v: Vector3, max: number): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq > max * max && magSq > 0) {
      const mag = Math.sqrt(magSq);
      return { x: (v.x / mag) * max, y: (v.y / mag) * max, z: (v.z / mag) * max };
    }
    return { x: v.x, y: v.y, z: v.z };
  }

  /**
   * Магнітуда вектора
   */
  static magnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Квадрат магнітуди
   */
  static magnitudeSq(v: Vector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /**
   * Скалярний добуток
   */
  static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * Векторний добуток
   */
  static cross(a: Vector3, b: Vector3): MutableVector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  /**
   * Додавання векторів
   */
  static add(a: Vector3, b: Vector3): MutableVector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  /**
   * Віднімання векторів
   */
  static sub(a: Vector3, b: Vector3): MutableVector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  /**
   * Множення вектора на скаляр
   */
  static scale(v: Vector3, s: number): MutableVector3 {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  // ============================================================================
  // ІНТЕРПОЛЯЦІЯ
  // ============================================================================

  /**
   * Лінійна інтерполяція
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Лінійна інтерполяція векторів
   */
  static lerpVector(a: Vector3, b: Vector3, t: number): MutableVector3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }

  /**
   * Плавна інтерполяція
   */
  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ============================================================================
  // ДОПОМІЖНІ ФУНКЦІЇ
  // ============================================================================

  /**
   * Обмежити значення
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Відображення діапазону
   */
  static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  /**
   * Випадкове число в діапазоні
   */
  static random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Випадковий вектор у сфері
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
   * Відбиття вектора від нормалі
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
