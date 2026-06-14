/**
 * GridManager - management of spatial hash grid.
 * Extracted from Engine.ts for better separation of responsibilities.
 */

import type { GridEntity, Vector3 } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import { SpatialHashGrid } from '../SpatialHashGrid.service';

/**
 * Spatial grid manager for optimizing neighbor searches.
 * Responsible for updating and clearing the spatial hash grid.
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
   * Rebuild spatial grid with current world state.
   * Inserts living organisms, unconsumed food, and obstacles (if enabled).
   */
  public rebuild(
    organisms: Map<string, Organism>,
    food: Map<string, Food>,
  ): void {
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
  public clear(): void {
    this.dynamicGrid.clear();
    // Do NOT clear static grid here
  }

  // Proxy methods to query BOTH grids

  public getNearby(position: Vector3, radius: number, result: GridEntity[]): void {
    // Clear buffer before use, as requested by user
    result.length = 0;

    const staticEntities = this.staticGrid.getNearby(position, radius);
    for (const e of staticEntities) {
      result.push(e);
    }

    const dynamicEntities = this.dynamicGrid.getNearby(position, radius);
    for (const e of dynamicEntities) {
      result.push(e);
    }
  }

  public getSpatialGrid(): SpatialHashGrid {
    // Return dynamic for cases where only dynamic is needed, 
    // OR throw error because systems should use GridManager directly now?
    // For backward compatibility, return dynamic. But this is dangerous if systems expect obstacles.
    return this.dynamicGrid;
  }

  public getStats(): { totalCells: number; totalEntities: number; avgEntitiesPerCell: number; maxEntitiesInCell: number } {
    const GRID_COUNT = 2;
    const s = this.staticGrid.getStats();
    const d = this.dynamicGrid.getStats();
    return {
      totalCells: s.totalCells + d.totalCells,
      totalEntities: s.totalEntities + d.totalEntities,
      avgEntitiesPerCell: (s.avgEntitiesPerCell + d.avgEntitiesPerCell) / GRID_COUNT, // approximate
      maxEntitiesInCell: Math.max(s.maxEntitiesInCell, d.maxEntitiesInCell)
    };
  }
}
