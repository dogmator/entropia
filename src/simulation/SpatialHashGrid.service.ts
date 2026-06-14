/**
 * Entropia 3D — Spatial Hashing System.
 *
 * Optimized data structure to ensure neighboring object searches
 * in 3D space with complexity close to O(1).
 *
 * Algorithmic base:
 * 1. Space segmentation into discrete fixed-size cells (CELL_SIZE).
 * 2. Hashing entity coordinates to establish their cell membership.
 * 3. Localizing search only in adjacent cells relative to the target point.
 *
 * Computational complexity:
 * - Object insertion: O(1).
 * - Neighborhood search: O(k), where k is population density in local cells.
 * - Structure clearing: O(n).
 */

import type { EntityType, GridEntity, Vector3 } from '@/types';

import { CELL_SIZE, WORLD_SIZE } from '../config';
import { MathUtils } from './MathUtils.utils';

/**
 * Spatial hash grid implementation for efficient spatial aggregation.
 */
export class SpatialHashGrid {
  /** Cell storage indexed by hash keys. */
  private readonly cells = new Map<number, GridEntity[]>();

  /** Linear edge size of a cubic cell. */
  private readonly cellSize: number;

  /** Grid dimension (number of cells along one axis). */
  private readonly dimensions: number;

  /** World size. */
  private readonly worldSize: number;

  /** Array pool for reuse (minimizing Garbage Collector load). */
  private readonly cellPool: GridEntity[][] = [];

  /** Result buffer for getNearby (avoiding allocations on every call). */
  private readonly nearbyBuffer: GridEntity[] = [];

  /** Result buffer for getNearbyExact (avoiding allocations on every call). */
  private readonly nearbyExactBuffer: GridEntity[] = [];

  constructor(worldSize: number = WORLD_SIZE, cellSize: number = CELL_SIZE) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.dimensions = Math.ceil(this.worldSize / this.cellSize);
  }

  /**
   * Generating unique hash key for spatial coordinates.
   * Considers toroidal world topology.
   */
  /**
   * Calculating cell coordinates for a given spatial point.
   */
  private getCellCoords(x: number, y: number, z: number): { gx: number, gy: number, gz: number } {
    const gx = Math.floor(((x % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    const gy = Math.floor(((y % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    const gz = Math.floor(((z % this.worldSize) + this.worldSize) % this.worldSize / this.cellSize);
    return { gx, gy, gz };
  }

  /**
   * Generating hash key from 3D cell indices.
   */
  private getKeyFromCoords(gx: number, gy: number, gz: number): number {
    return gx + gy * this.dimensions + gz * this.dimensions * this.dimensions;
  }

  /**
   * Generating unique hash key for spatial coordinates.
   * Considers toroidal world topology.
   */
  private getKey(x: number, y: number, z: number): number {
    const { gx, gy, gz } = this.getCellCoords(x, y, z);
    return this.getKeyFromCoords(gx, gy, gz);
  }

  /**
   * Adding all entities from a cell to the results buffer.
   */
  private pushCellEntities(results: GridEntity[], key: number): void {
    const cell = this.cells.get(key);
    if (!cell) { return; }
    for (const item of cell) {
      results.push(item);
    }
  }

  /**
   * Resetting grid state to prepare for a new iteration cycle.
   */
  public clear(): void {
    // Evacuating arrays to pool for reuse
    this.cells.forEach(cell => {
      cell.length = 0;
      this.cellPool.push(cell);
    });
    this.cells.clear();
  }

  /**
   * Registering an entity in the corresponding spatial cell.
   */
  public insert(entity: GridEntity): void {
    const key = this.getKey(
      entity.position.x,
      entity.position.y,
      entity.position.z
    );

    let cell = this.cells.get(key);
    if (!cell) {
      // Getting array from pool or initializing new one
      cell = this.cellPool.pop() ?? [];
      this.cells.set(key, cell);
    }

    cell.push(entity);
  }

  /**
   * Aggregating candidates in the vicinity of a given point.
   *
   * @param position Search sphere center.
   * @param radius Search sphere radius.
   * @returns Array of potential neighbors (candidates from covered cells).
   */
  public getNearby(position: Vector3, radius: number): readonly GridEntity[] {
    this.nearbyBuffer.length = 0;
    const results = this.nearbyBuffer;

    // Determining cell range for inspection
    const cellRadius = Math.ceil(radius / this.cellSize);

    // Central cell coordinates
    const { gx: centerX, gy: centerY, gz: centerZ } = this.getCellCoords(position.x, position.y, position.z);

    // Iterating over adjacent cells in given radius
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        this.pushNeighborSlice(results, { centerX, centerY, centerZ, dx, dy, cellRadius });
      }
    }

    return results;
  }

  /**
   * Iterating over cells along Z axis for fixed dx/dy and adding their entities to results.
   */
  private pushNeighborSlice(
    results: GridEntity[],
    opts: { centerX: number, centerY: number, centerZ: number, dx: number, dy: number, cellRadius: number }
  ): void {
    const { centerX, centerY, centerZ, dx, dy, cellRadius } = opts;
    const gx = (centerX + dx + this.dimensions) % this.dimensions;
    const gy = (centerY + dy + this.dimensions) % this.dimensions;

    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
      const gz = (centerZ + dz + this.dimensions) % this.dimensions;
      const key = this.getKeyFromCoords(gx, gy, gz);
      this.pushCellEntities(results, key);
    }
  }

  /**
   * Searching for neighbors with precision distance check.
   * Considers toroidal space metric.
   */
  public getNearbyExact(position: Vector3, radius: number): readonly GridEntity[] {
    const candidates = this.getNearby(position, radius);
    this.nearbyExactBuffer.length = 0;
    const results = this.nearbyExactBuffer;
    const radiusSq = radius * radius;


    for (const entity of candidates) {
      const distSq = MathUtils.toroidalDistanceSq(entity.position, position, this.worldSize);

      if (distSq <= radiusSq) {
        results.push(entity);
      }
    }

    return results;
  }

  /**
   * Searching for the nearest object of given specification (type).
   */
  // eslint-disable-next-line max-params
  public findNearest(
    position: Vector3,
    radius: number,
    type: EntityType,
    excludeId?: string
  ): GridEntity | null {
    const candidates = this.getNearby(position, radius);
    let nearest: GridEntity | null = null;
    let nearestDistSq = Infinity;


    for (const entity of candidates) {
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
   * Calculating number of entities of a certain type in given radius.
   */
  public countNearby(position: Vector3, radius: number, type?: EntityType): number {
    const candidates = this.getNearby(position, radius);
    let count = 0;

    for (const item of candidates) {
      if (!type || item.type === type) {
        count++;
      }
    }

    return count;
  }

  /**
   * Getting diagnostic metrics of hash grid state.
   */
  public getStats(): {
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
