
import { Vector3, Genome, EntityType } from '../types';

export abstract class Entity {
  constructor(
    public id: string,
    public position: Vector3,
    public radius: number,
    public type: EntityType
  ) {}
}

export class Food extends Entity {
  public energyValue: number = 25;
  constructor(id: string, position: Vector3) {
    super(id, position, 2, EntityType.FOOD);
  }
}

export class Obstacle extends Entity {
  public color: number;
  public opacity: number;

  constructor(id: string, position: Vector3, radius: number, color: number, opacity: number) {
    super(id, position, radius, EntityType.OBSTACLE);
    this.color = color;
    this.opacity = opacity;
  }
}

export class Organism extends Entity {
  public velocity: Vector3 = { 
    x: (Math.random() - 0.5) * 2, 
    y: (Math.random() - 0.5) * 2, 
    z: (Math.random() - 0.5) * 2 
  };
  public acceleration: Vector3 = { x: 0, y: 0, z: 0 };
  public energy: number = 100;
  public age: number = 0;
  public isDead: boolean = false;
  public trailEnabled: boolean = false;

  constructor(
    id: string,
    position: Vector3,
    public genome: Genome
  ) {
    super(id, position, genome.size, genome.type);
  }

  die() {
    this.isDead = true;
  }
}
