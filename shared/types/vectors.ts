/**
 * Entropia 3D — Типи для векторного аналізу.
 *
 * Визначає імутабельні та мутабельні версії тривимірних векторів
 * для використання в різних контекстах симуляції.
 *
 * @module shared/types/vectors
 */

/**
 * Імутабельний тривимірний вектор (Euclidean Vector).
 *
 * Використовується для передачі даних між компонентами,
 * де модифікація не передбачена.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Мутабельний тривимірний вектор для ітераційних обчислень.
 *
 * Використовується всередині Engine для оптимізації
 * (уникнення створення нових об'єктів).
 */
export interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// ДОПОМІЖНІ ФУНКЦІЇ РОБОТИ З ВЕКТОРАМИ
// ============================================================================

/**
 * Створює імутабельний вектор з координатами.
 */
export const vec3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

/**
 * Створює нульовий мутабельний вектор.
 */
export const vec3Zero = (): MutableVector3 => ({ x: 0, y: 0, z: 0 });

/**
 * Клонує вектор у мутабельну версію.
 */
export const vec3Clone = (v: Vector3): MutableVector3 => ({
  x: v.x,
  y: v.y,
  z: v.z,
});

/**
 * Обчислює модуль (довжину) вектора.
 */
export const vec3Length = (v: Vector3): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

/**
 * Нормалізує вектор (приводить до одиничної довжини).
 */
export const vec3Normalize = (v: Vector3): Vector3 => {
  const len = vec3Length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

/**
 * Обчислює відстань між двома точками.
 */
export const vec3Distance = (a: Vector3, b: Vector3): number =>
  Math.sqrt(
    (a.x - b.x) * (a.x - b.x) +
    (a.y - b.y) * (a.y - b.y) +
    (a.z - b.z) * (a.z - b.z)
  );

/**
 * Додає два вектори.
 */
export const vec3Add = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

/**
 * Віднімає один вектор від іншого.
 */
export const vec3Sub = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

/**
 * Множить вектор на скаляр.
 */
export const vec3Scale = (v: Vector3, s: number): Vector3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});
