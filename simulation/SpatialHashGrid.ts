
import { Vector3, EntityType } from '../types';
import { WORLD_SIZE, CELL_SIZE } from '../constants';

interface GridEntity {
  id: string;
  position: Vector3;
  type: EntityType;
}

export class SpatialHashGrid {
  private grid: Map<number, GridEntity[]> = new Map();
  private cellSize: number;
  private dims: number;

  constructor() {
    this.cellSize = CELL_SIZE;
    this.dims = Math.ceil(WORLD_SIZE / this.cellSize);
  }

  private getKey(x: number, y: number, z: number): number {
    const gx = Math.floor(((x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const gy = Math.floor(((y % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const gz = Math.floor(((z % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    // Unique numeric key for the grid cell
    return gx + (gy * this.dims) + (gz * this.dims * this.dims);
  }

  clear() {
    this.grid.clear();
  }

  insert(entity: GridEntity) {
    const key = this.getKey(entity.position.x, entity.position.y, entity.position.z);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(entity);
  }

  getNearby(pos: Vector3, radius: number): GridEntity[] {
    const results: GridEntity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const centerX = Math.floor(((pos.x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const centerY = Math.floor(((pos.y % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);
    const centerZ = Math.floor(((pos.z % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const gx = (centerX + dx + this.dims) % this.dims;
          const gy = (centerY + dy + this.dims) % this.dims;
          const gz = (centerZ + dz + this.dims) % this.dims;
          const key = gx + (gy * this.dims) + (gz * this.dims * this.dims);
          const entities = this.grid.get(key);
          if (entities) {
            for (let i = 0; i < entities.length; i++) {
              results.push(entities[i]);
            }
          }
        }
      }
    }
    return results;
  }
}
