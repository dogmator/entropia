/**
 * GridManager - управление spatial hash grid.
 * Извлечено из Engine.ts для лучшего разделения ответственности.
 */

import type { GridEntity } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import type { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Менеджер пространственной сетки для оптимизации поиска соседей.
 * Отвечает за обновление и очистку spatial hash grid.
 */
export class GridManager {
  constructor(private readonly spatialGrid: SpatialHashGrid) {}

  /**
   * Перестроить spatial grid с текущим состоянием мира.
   * Вставляет живые организмы, несъеденную еду и препятствия (если включены).
   */
  rebuild(
    organisms: Map<string, Organism>,
    food: Map<string, Food>,
    obstacles: Map<string, Obstacle>,
    showObstacles: boolean
  ): void {
    this.spatialGrid.clear();

    const insertEntity = (e: GridEntity) => {
      this.spatialGrid.insert({
        id: e.id,
        position: e.position,
        type: e.type,
        radius: e.radius,
      });
    };

    organisms.forEach(o => {
      if (!o.isDead) {
        insertEntity(o);
      }
    });

    food.forEach(f => {
      if (!f.consumed) {
        insertEntity(f);
      }
    });

    if (showObstacles) {
      obstacles.forEach(insertEntity);
    }
  }

  /**
   * Очистить spatial grid.
   */
  clear(): void {
    this.spatialGrid.clear();
  }
}
