
/**
 * EVOSIM 3D — Просторове Хешування
 *
 * Оптимізована структура даних для O(1) пошуку сусідів у 3D просторі.
 *
 * Алгоритм:
 * 1. Простір поділяється на комірки розміром CELL_SIZE
 * 2. Кожна сутність потрапляє в комірку за своїми координатами
 * 3. Пошук сусідів перевіряє лише сусідні комірки
 *
 * Складність:
 * - Вставка: O(1)
 * - Пошук сусідів: O(k), де k — кількість сутностей у сусідніх комірках
 * - Очищення: O(n)
 */

import { Vector3, EntityType, GridEntity } from '../types';
import { WORLD_SIZE, CELL_SIZE } from '../constants';

/**
 * Внутрішній тип для сутностей у сітці
 */
interface InternalGridEntity {
  readonly id: string;
  readonly position: Vector3;
  readonly type: EntityType;
  readonly radius: number;
}

/**
 * Просторова хеш-сітка для ефективного пошуку сусідів
 */
export class SpatialHashGrid {
  /** Зберігання комірок за хешем */
  private readonly cells: Map<number, InternalGridEntity[]> = new Map();

  /** Розмір комірки */
  private readonly cellSize: number;

  /** Кількість комірок по кожній осі */
  private readonly dimensions: number;

  /** Кешовані комірки для повторного використання */
  private readonly cellPool: InternalGridEntity[][] = [];

  constructor(cellSize: number = CELL_SIZE) {
    this.cellSize = cellSize;
    this.dimensions = Math.ceil(WORLD_SIZE / this.cellSize);
  }

  /**
   * Обчислити хеш-ключ для позиції
   *
   * Використовує тороїдальну геометрію для обгортання координат
   */
  private getKey(x: number, y: number, z: number): number {
    // Обгортання координат для тороїдального простору
    const gx = Math.floor(((x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const gy = Math.floor(((y % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const gz = Math.floor(((z % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);

    // Унікальний числовий ключ для комірки
    // Використовуємо просту формулу для 3D індексу
    return gx + gy * this.dimensions + gz * this.dimensions * this.dimensions;
  }

  /**
   * Очистити сітку для нового кадру
   */
  clear(): void {
    // Зберігаємо масиви для повторного використання
    this.cells.forEach(cell => {
      cell.length = 0;
      this.cellPool.push(cell);
    });
    this.cells.clear();
  }

  /**
   * Вставити сутність у сітку
   */
  insert(entity: GridEntity): void {
    const key = this.getKey(
      entity.position.x,
      entity.position.y,
      entity.position.z
    );

    let cell = this.cells.get(key);
    if (!cell) {
      // Використати кешований масив або створити новий
      cell = this.cellPool.pop() || [];
      this.cells.set(key, cell);
    }

    cell.push(entity as InternalGridEntity);
  }

  /**
   * Знайти всіх сусідів у заданому радіусі
   *
   * @param position Центр пошуку
   * @param radius Радіус пошуку
   * @returns Масив сусідніх сутностей
   */
  getNearby(position: Vector3, radius: number): readonly InternalGridEntity[] {
    const results: InternalGridEntity[] = [];

    // Кількість комірок для перевірки по кожній осі
    const cellRadius = Math.ceil(radius / this.cellSize);

    // Центральна комірка
    const centerX = Math.floor(((position.x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const centerY = Math.floor(((position.y % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const centerZ = Math.floor(((position.z % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);

    // Квадрат радіуса для швидкого порівняння
    const radiusSq = radius * radius;

    // Перебір сусідніх комірок
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          // Тороїдальне обгортання індексів
          const gx = (centerX + dx + this.dimensions) % this.dimensions;
          const gy = (centerY + dy + this.dimensions) % this.dimensions;
          const gz = (centerZ + dz + this.dimensions) % this.dimensions;

          const key = gx + gy * this.dimensions + gz * this.dimensions * this.dimensions;
          const cell = this.cells.get(key);

          if (cell) {
            // Додаємо всі сутності з комірки
            // Точна перевірка відстані робиться пізніше
            for (let i = 0; i < cell.length; i++) {
              results.push(cell[i]);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Знайти всіх сусідів з точною перевіркою відстані
   *
   * Враховує тороїдальну геометрію світу
   */
  getNearbyExact(position: Vector3, radius: number): readonly InternalGridEntity[] {
    const candidates = this.getNearby(position, radius);
    const results: InternalGridEntity[] = [];
    const radiusSq = radius * radius;
    const halfWorld = WORLD_SIZE / 2;

    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];

      // Тороїдальна відстань
      let dx = entity.position.x - position.x;
      let dy = entity.position.y - position.y;
      let dz = entity.position.z - position.z;

      // Обгортання для найкоротшої відстані
      if (dx > halfWorld) dx -= WORLD_SIZE;
      else if (dx < -halfWorld) dx += WORLD_SIZE;

      if (dy > halfWorld) dy -= WORLD_SIZE;
      else if (dy < -halfWorld) dy += WORLD_SIZE;

      if (dz > halfWorld) dz -= WORLD_SIZE;
      else if (dz < -halfWorld) dz += WORLD_SIZE;

      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= radiusSq) {
        results.push(entity);
      }
    }

    return results;
  }

  /**
   * Знайти найближчу сутність заданого типу
   */
  findNearest(
    position: Vector3,
    radius: number,
    type: EntityType,
    excludeId?: string
  ): InternalGridEntity | null {
    const candidates = this.getNearby(position, radius);
    let nearest: InternalGridEntity | null = null;
    let nearestDistSq = Infinity;
    const halfWorld = WORLD_SIZE / 2;

    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];

      if (entity.type !== type) continue;
      if (excludeId && entity.id === excludeId) continue;

      // Тороїдальна відстань
      let dx = entity.position.x - position.x;
      let dy = entity.position.y - position.y;
      let dz = entity.position.z - position.z;

      if (dx > halfWorld) dx -= WORLD_SIZE;
      else if (dx < -halfWorld) dx += WORLD_SIZE;

      if (dy > halfWorld) dy -= WORLD_SIZE;
      else if (dy < -halfWorld) dy += WORLD_SIZE;

      if (dz > halfWorld) dz -= WORLD_SIZE;
      else if (dz < -halfWorld) dz += WORLD_SIZE;

      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = entity;
      }
    }

    return nearest;
  }

  /**
   * Підрахувати сутності заданого типу в радіусі
   */
  countNearby(position: Vector3, radius: number, type?: EntityType): number {
    const candidates = this.getNearby(position, radius);
    let count = 0;

    for (let i = 0; i < candidates.length; i++) {
      if (!type || candidates[i].type === type) {
        count++;
      }
    }

    return count;
  }

  /**
   * Отримати статистику сітки для відлагодження
   */
  getStats(): {
    totalCells: number;
    totalEntities: number;
    avgEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    let totalEntities = 0;
    let maxEntitiesInCell = 0;

    this.cells.forEach(cell => {
      totalEntities += cell.length;
      if (cell.length > maxEntitiesInCell) {
        maxEntitiesInCell = cell.length;
      }
    });

    return {
      totalCells: this.cells.size,
      totalEntities,
      avgEntitiesPerCell: this.cells.size > 0 ? totalEntities / this.cells.size : 0,
      maxEntitiesInCell,
    };
  }
}
