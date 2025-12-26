/**
 * Entropia 3D — Система просторового хешування (Spatial Hashing).
 *
 * Оптимізована структура даних для забезпечення пошуку сусідніх об'єктів
 * у тривимірному просторі зі складністю, близькою до O(1).
 *
 * Алгоритмічна база:
 * 1. Сегментація простору на дискретні комірки фіксованого розміру (CELL_SIZE).
 * 2. Хешування координат сутностей для встановлення їхньої приналежності до комірок.
 * 3. Локалізація пошуку лише у суміжних комірках відносно цільової точки.
 *
 * Обчислювальна складність:
 * - Вставка об'єкта: O(1).
 * - Пошук околиці: O(k), де k — щільність популяції у локальних комірках.
 * - Очистка структури: O(n).
 */

import type { EntityType, GridEntity, Vector3 } from '@/types';

import { CELL_SIZE, WORLD_SIZE } from '../constants';
import { MathUtils } from './MathUtils';

/**
 * Внутрішня структура даних для інкапсуляції атрибутів сутності в межах сітки.
 */
interface InternalGridEntity {
  readonly id: string;
  readonly position: Vector3;
  readonly type: EntityType;
  readonly radius: number;
}

/**
 * Реалізація просторової хеш-сітки для ефективної просторової агрегації.
 */
export class SpatialHashGrid {
  /** Сховище комірок, індексоване за хеш-ключами. */
  private readonly cells: Map<number, InternalGridEntity[]> = new Map();

  /** Лінійний розмір ребра кубічної комірки. */
  private readonly cellSize: number;

  /** Розмітність сітки (кількість комірок вздовж однієї осі). */
  private readonly dimensions: number;

  /** Розмір світу. */
  private readonly worldSize: number;

  /** Пул масивів для повторного використання (мінімізація навантаження на Garbage Collector). */
  private readonly cellPool: InternalGridEntity[][] = [];

  constructor(worldSize: number = WORLD_SIZE, cellSize: number = CELL_SIZE) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.dimensions = Math.ceil(this.worldSize / this.cellSize);
  }

  /**
   * Генерація унікального хеш-ключа для просторових координат.
   * Враховує тороїдальну топологію світу.
   */
  /**
   * Розрахунок координат комірки для заданої точки простору.
   */
  private getCellCoords(x: number, y: number, z: number): { gx: number, gy: number, gz: number } {
    const gx = Math.floor(((x % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    const gy = Math.floor(((y % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    const gz = Math.floor(((z % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    return { gx, gy, gz };
  }

  /**
   * Генерація хеш-ключа з тривимірних індексів комірки.
   */
  private getKeyFromCoords(gx: number, gy: number, gz: number): number {
    return gx + gy * this.dimensions + gz * this.dimensions * this.dimensions;
  }

  /**
   * Генерація унікального хеш-ключа для просторових координат.
   * Враховує тороїдальну топологію світу.
   */
  private getKey(x: number, y: number, z: number): number {
    const { gx, gy, gz } = this.getCellCoords(x, y, z);
    return this.getKeyFromCoords(gx, gy, gz);
  }

  /**
   * Скидання стану сітки для підготовки до нового ітераційного циклу.
   */
  clear(): void {
    // Евакуація масивів до пулу для повторного використання
    this.cells.forEach(cell => {
      cell.length = 0;
      this.cellPool.push(cell);
    });
    this.cells.clear();
  }

  /**
   * Реєстрація сутності у відповідній просторовій комірці.
   */
  insert(entity: GridEntity): void {
    const key = this.getKey(
      entity.position.x,
      entity.position.y,
      entity.position.z
    );

    let cell = this.cells.get(key);
    if (!cell) {
      // Отримання масиву з пулу або ініціалізація нового
      cell = this.cellPool.pop() || [];
      this.cells.set(key, cell);
    }

    cell.push(entity as InternalGridEntity);
  }

  /**
   * Агрегація кандидатів у сусідній околиці заданої точки.
   *
   * @param position Центр сфери пошуку.
   * @param radius Радіус сфери пошуку.
   * @returns Масив потенційних сусідів (кандидати з охоплених комірок).
   */
  getNearby(position: Vector3, radius: number): readonly InternalGridEntity[] {
    const results: InternalGridEntity[] = [];

    // Визначення діапазону комірок для інспекції
    const cellRadius = Math.ceil(radius / this.cellSize);

    // Координати центральної комірки
    const { gx: centerX, gy: centerY, gz: centerZ } = this.getCellCoords(position.x, position.y, position.z);

    // Перебір суміжних комірок у заданому радіусі
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          // Тороїдальне обгортання просторових індексів
          const gx = (centerX + dx + this.dimensions) % this.dimensions;
          const gy = (centerY + dy + this.dimensions) % this.dimensions;
          const gz = (centerZ + dz + this.dimensions) % this.dimensions;

          const key = this.getKeyFromCoords(gx, gy, gz);
          const cell = this.cells.get(key);

          if (cell) {
            // Групове додавання сутностей до списку кандидатів
            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              if (item) {
                results.push(item);
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Пошук сусідів з прецизійною перевіркою відстані.
   * Враховує тороїдальну метрику простору.
   */
  getNearbyExact(position: Vector3, radius: number): readonly InternalGridEntity[] {
    const candidates = this.getNearby(position, radius);
    const results: InternalGridEntity[] = [];
    const radiusSq = radius * radius;


    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];

      if (!entity) { continue; }
      const distSq = MathUtils.toroidalDistanceSq(entity.position, position, this.worldSize);

      if (entity && distSq <= radiusSq) {
        results.push(entity);
      }
    }

    return results;
  }

  /**
   * Пошук найближчого об'єкта заданої специфікації (типу).
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


    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];

      if (!entity) { continue; }
      if (entity.type !== type) { continue; }
      if (excludeId && entity.id === excludeId) { continue; }

      const distSq = MathUtils.toroidalDistanceSq(entity.position, position, this.worldSize);

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = entity;
      }
    }

    return nearest;
  }

  /**
   * Розрахунок кількості сутностей певного типу в заданому радіусі.
   */
  countNearby(position: Vector3, radius: number, type?: EntityType): number {
    const candidates = this.getNearby(position, radius);
    let count = 0;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      if (item && (!type || item.type === type)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Отримання діагностичних метрик стану хеш-сітки.
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
