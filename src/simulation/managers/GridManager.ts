/**
 * GridManager - управление spatial hash grid.
 * Извлечено из Engine.ts для лучшего разделения ответственности.
 */

import type { GridEntity } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Менеджер пространственной сетки для оптимизации поиска соседей.
 * Отвечает за обновление и очистку spatial hash grid.
 */
export class GridManager {
  private readonly staticGrid: SpatialHashGrid;
  private readonly dynamicGrid: SpatialHashGrid;


  constructor(
    worldSize: number,
    cellSize: number
  ) {
    this.staticGrid = new SpatialHashGrid(worldSize, cellSize);
    this.dynamicGrid = new SpatialHashGrid(worldSize, cellSize);
  }

  /**
   * Initialize static grid with obstacles. Should be called once or when obstacles change.
   */
  public initializeStatic(obstacles: Map<string, Obstacle>): void {
    this.staticGrid.clear();
    obstacles.forEach(o => {
      this.staticGrid.insert({
        id: o.id,
        position: o.position,
        type: o.type,
        radius: o.radius,
      });
    });
  }

  /**
   * Перестроить spatial grid с текущим состоянием мира.
   * Вставляет живые организмы, несъеденную еду и препятствия (если включены).
   */
  rebuild(
    organisms: Map<string, Organism>,
    food: Map<string, Food>,
  ): void {
    if (!organisms || !food) {
      console.warn('GridManager.rebuild skipped: One or more collections are undefined.');
      return;
    }
    this.dynamicGrid.clear();

    const insertEntity = (e: GridEntity) => {
      this.dynamicGrid.insert({
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
  }

  /**
   * Clears ONLY the dynamic grid.
   */
  clear(): void {
    this.dynamicGrid.clear();
    // Do NOT clear static grid here
  }

  // Proxy methods to query BOTH grids

  public getNearby(position: any, radius: number, result: GridEntity[]): void {
    // Очищуємо буфер перед використанням, як запитував користувач
    result.length = 0;

    const staticEntities = this.staticGrid.getNearby(position, radius);
    for (let i = 0; i < staticEntities.length; i++) {
      const e = staticEntities[i];
      if (e) result.push(e as any);
    }

    const dynamicEntities = this.dynamicGrid.getNearby(position, radius);
    for (let i = 0; i < dynamicEntities.length; i++) {
      const e = dynamicEntities[i];
      if (e) result.push(e as any);
    }
  }

  public getSpatialGrid(): SpatialHashGrid {
    // Return dynamic for cases where only dynamic is needed, 
    // OR throw error because systems should use GridManager directly now?
    // For backward compatibility, return dynamic. But this is dangerous if systems expect obstacles.
    return this.dynamicGrid;
  }

  public getStats() {
    const s = this.staticGrid.getStats();
    const d = this.dynamicGrid.getStats();
    return {
      totalCells: s.totalCells + d.totalCells,
      totalEntities: s.totalEntities + d.totalEntities,
      avgEntitiesPerCell: (s.avgEntitiesPerCell + d.avgEntitiesPerCell) / 2, // approximate
      maxEntitiesInCell: Math.max(s.maxEntitiesInCell, d.maxEntitiesInCell)
    }
  }
}
