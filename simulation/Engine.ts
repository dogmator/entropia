
import { 
  EntityType, 
  SimulationEvent, 
  Genome, 
  SimulationStats, 
  Vector3,
  SimulationConfig 
} from '../types';
import { 
  WORLD_SIZE, 
  INITIAL_PREY, 
  INITIAL_PREDATOR, 
  MAX_FOOD, 
  FOOD_SPAWN_RATE, 
  METABOLIC_CONSTANTS,
  PHYSICS,
  REPRODUCTION_ENERGY_THRESHOLD,
  MAX_TOTAL_ORGANISMS,
  INITIAL_VIS_CONFIG
} from '../constants';
import { Organism, Food, Obstacle } from './Entity';
import { SpatialHashGrid } from './SpatialHashGrid';
import { MathUtils } from './MathUtils';

export class SimulationEngine {
  public organisms: Map<string, Organism> = new Map();
  public food: Map<string, Food> = new Map();
  public obstacles: Map<string, Obstacle> = new Map();
  private grid: SpatialHashGrid = new SpatialHashGrid();
  private nextId: number = 0;
  private listeners: ((event: SimulationEvent) => void)[] = [];
  
  private stats_totalDeaths: number = 0;
  private stats_maxAge: number = 0;

  public config: SimulationConfig = {
    foodSpawnRate: FOOD_SPAWN_RATE,
    maxFood: MAX_FOOD,
    mutationFactor: 0.1,
    reproductionThreshold: REPRODUCTION_ENERGY_THRESHOLD,
    physicsDrag: PHYSICS.drag,
    separationWeight: PHYSICS.separationWeight,
    seekWeight: PHYSICS.seekWeight,
    avoidWeight: PHYSICS.avoidWeight,
    ...INITIAL_VIS_CONFIG
  };

  constructor() {
    this.init();
  }

  public reset() {
    this.organisms.clear();
    this.food.clear();
    this.obstacles.clear();
    this.grid.clear();
    this.nextId = 0;
    this.stats_totalDeaths = 0;
    this.stats_maxAge = 0;
    this.init();
  }

  private init() {
    const obstacleCount = 15;
    for (let i = 0; i < obstacleCount; i++) {
      const radius = 10 + Math.random() * 30;
      const pos = {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        z: Math.random() * WORLD_SIZE
      };
      const color = Math.random() * 0xffffff;
      const opacity = 0.2 + Math.random() * 0.6;
      const obstacle = new Obstacle(this.generateId(), pos, radius, color, opacity);
      this.obstacles.set(obstacle.id, obstacle);
    }

    for (let i = 0; i < INITIAL_PREY; i++) {
      this.spawnOrganism(EntityType.PREY);
    }
    for (let i = 0; i < INITIAL_PREDATOR; i++) {
      this.spawnOrganism(EntityType.PREDATOR);
    }
  }

  private generateId(): string {
    return (this.nextId++).toString();
  }

  addEventListener(callback: (event: SimulationEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: SimulationEvent) {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](event);
    }
  }

  private createGenome(type: EntityType, base?: Genome): Genome {
    const mf = this.config.mutationFactor;
    const mutation = () => (1 - mf/2) + Math.random() * mf;
    
    if (type === EntityType.PREY) {
      return {
        id: this.generateId(),
        type: EntityType.PREY,
        color: 0x44ff44,
        maxSpeed: Math.max(0.8, (base?.maxSpeed || 2.0) * mutation()),
        senseRadius: Math.max(30, (base?.senseRadius || 80) * mutation()),
        metabolism: Math.max(0.1, (base?.metabolism || 1.0) * mutation()),
        size: Math.max(2, (base?.size || 4) * mutation())
      };
    } else {
      return {
        id: this.generateId(),
        type: EntityType.PREDATOR,
        color: 0xff4444,
        maxSpeed: Math.max(1.0, (base?.maxSpeed || 2.4) * mutation()),
        senseRadius: Math.max(50, (base?.senseRadius || 150) * mutation()),
        metabolism: Math.max(0.1, (base?.metabolism || 1.1) * mutation()),
        size: Math.max(3, (base?.size || 6) * mutation())
      };
    }
  }

  private spawnOrganism(type: EntityType, pos?: Vector3, genome?: Genome) {
    if (this.organisms.size >= MAX_TOTAL_ORGANISMS) return;
    
    const position = pos || { 
      x: Math.random() * WORLD_SIZE, 
      y: Math.random() * WORLD_SIZE, 
      z: Math.random() * WORLD_SIZE 
    };
    const gen = genome || this.createGenome(type);
    const organism = new Organism(this.generateId(), position, gen);
    this.organisms.set(organism.id, organism);
    this.emit({ type: 'EntitySpawned', entity: organism });
  }

  private spawnFood() {
    if (this.food.size < this.config.maxFood) {
      if (Math.random() < this.config.foodSpawnRate) {
        const food = new Food(this.generateId(), { 
          x: Math.random() * WORLD_SIZE, 
          y: Math.random() * WORLD_SIZE,
          z: Math.random() * WORLD_SIZE
        });
        this.food.set(food.id, food);
        this.emit({ type: 'EntitySpawned', entity: food });
      }
    }
  }

  update() {
    this.spawnFood();
    this.grid.clear();
    this.organisms.forEach(o => this.grid.insert({ id: o.id, position: o.position, type: o.type }));
    this.food.forEach(f => this.grid.insert({ id: f.id, position: f.position, type: f.type }));
    this.obstacles.forEach(ob => this.grid.insert({ id: ob.id, position: ob.position, type: ob.type }));

    const deadIds: string[] = [];
    const newborns: { type: EntityType, pos: Vector3, gen: Genome }[] = [];

    this.organisms.forEach(org => {
      this.applyBehaviors(org);
      this.integrate(org);
      this.handleMetabolism(org);
      this.handleCollisions(org);

      if (org.age > this.stats_maxAge) this.stats_maxAge = org.age;

      if (org.energy <= 0 || isNaN(org.energy)) org.die();
      if (org.isDead) {
        deadIds.push(org.id);
      } else if (org.energy > this.config.reproductionThreshold) {
        org.energy *= 0.5;
        newborns.push({
          type: org.type,
          pos: { ...org.position },
          gen: this.createGenome(org.type, org.genome)
        });
      }
    });

    for (const newborn of newborns) {
      this.spawnOrganism(newborn.type, newborn.pos, newborn.gen);
    }

    for (const id of deadIds) {
      const org = this.organisms.get(id);
      if (org) {
        this.stats_totalDeaths++;
        this.emit({ type: 'EntityDied', id, entityType: org.type });
        this.organisms.delete(id);
      }
    }

    this.emit({ type: 'TickUpdated', stats: this.calculateStats() });
  }

  private applyBehaviors(org: Organism) {
    const neighbors = this.grid.getNearby(org.position, org.genome.senseRadius);
    let steerSeparation = { x: 0, y: 0, z: 0 };
    let steerHunger = { x: 0, y: 0, z: 0 };
    let steerFear = { x: 0, y: 0, z: 0 };
    let steerObstacle = { x: 0, y: 0, z: 0 };

    let countSep = 0;
    let closestFoodDist = Infinity;
    let closestPreyDist = Infinity;
    let targetFood: Vector3 | null = null;
    let targetPrey: Vector3 | null = null;

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n.id === org.id) continue;
      
      const distSq = MathUtils.toroidalDistanceSq(org.position, n.position);
      const dist = Math.sqrt(distSq);
      if (dist === 0) continue;

      if (n.type === EntityType.OBSTACLE) {
        const obs = this.obstacles.get(n.id);
        if (obs && dist < obs.radius + org.radius + 20) {
          const diff = MathUtils.toroidalVector(n.position, org.position);
          const normalized = MathUtils.normalize(diff);
          steerObstacle.x += normalized.x / dist;
          steerObstacle.y += normalized.y / dist;
          steerObstacle.z += normalized.z / dist;
        }
        continue;
      }

      if (dist < org.radius + 15) {
        const diff = MathUtils.toroidalVector(n.position, org.position);
        const normalized = MathUtils.normalize(diff);
        const safeDist = Math.max(dist, 2.0);
        steerSeparation.x += normalized.x / safeDist;
        steerSeparation.y += normalized.y / safeDist;
        steerSeparation.z += normalized.z / safeDist;
        countSep++;
      }

      if (org.type === EntityType.PREY) {
        if (n.type === EntityType.FOOD && dist < closestFoodDist) {
          closestFoodDist = dist;
          targetFood = n.position;
        } else if (n.type === EntityType.PREDATOR) {
          const diff = MathUtils.toroidalVector(n.position, org.position);
          const normalized = MathUtils.normalize(diff);
          steerFear.x += normalized.x / (dist * dist);
          steerFear.y += normalized.y / (dist * dist);
          steerFear.z += normalized.z / (dist * dist);
        }
      } else {
        if (n.type === EntityType.PREY && dist < closestPreyDist) {
          closestPreyDist = dist;
          targetPrey = n.position;
        }
      }
    }

    if (countSep > 0) steerSeparation = MathUtils.normalize(steerSeparation);
    if (targetFood) steerHunger = MathUtils.normalize(MathUtils.toroidalVector(org.position, targetFood));
    if (targetPrey) steerHunger = MathUtils.normalize(MathUtils.toroidalVector(org.position, targetPrey));
    if (steerFear.x !== 0 || steerFear.y !== 0 || steerFear.z !== 0) steerFear = MathUtils.normalize(steerFear);
    if (steerObstacle.x !== 0 || steerObstacle.y !== 0 || steerObstacle.z !== 0) steerObstacle = MathUtils.normalize(steerObstacle);

    org.acceleration.x += steerSeparation.x * this.config.separationWeight;
    org.acceleration.y += steerSeparation.y * this.config.separationWeight;
    org.acceleration.z += steerSeparation.z * this.config.separationWeight;
    
    org.acceleration.x += steerHunger.x * this.config.seekWeight;
    org.acceleration.y += steerHunger.y * this.config.seekWeight;
    org.acceleration.z += steerHunger.z * this.config.seekWeight;
    
    org.acceleration.x += steerFear.x * this.config.avoidWeight;
    org.acceleration.y += steerFear.y * this.config.avoidWeight;
    org.acceleration.z += steerFear.z * this.config.avoidWeight;

    org.acceleration.x += steerObstacle.x * 10;
    org.acceleration.y += steerObstacle.y * 10;
    org.acceleration.z += steerObstacle.z * 10;
  }

  private integrate(org: Organism) {
    org.velocity.x += org.acceleration.x;
    org.velocity.y += org.acceleration.y;
    org.velocity.z += org.acceleration.z;
    
    org.velocity = MathUtils.limit(org.velocity, org.genome.maxSpeed);
    
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z);
    
    org.acceleration.x = 0;
    org.acceleration.y = 0;
    org.acceleration.z = 0;
    
    org.velocity.x *= this.config.physicsDrag;
    org.velocity.y *= this.config.physicsDrag;
    org.velocity.z *= this.config.physicsDrag;
  }

  private handleMetabolism(org: Organism) {
    const vSq = org.velocity.x * org.velocity.x + org.velocity.y * org.velocity.y + org.velocity.z * org.velocity.z;
    const loss = (
      METABOLIC_CONSTANTS.exist * (org.radius * 0.5) +
      METABOLIC_CONSTANTS.move * vSq +
      METABOLIC_CONSTANTS.sense * org.genome.senseRadius * 0.1
    ) * org.genome.metabolism;
    
    org.energy -= loss;
    org.age++;
  }

  private handleCollisions(org: Organism) {
    const neighbors = this.grid.getNearby(org.position, org.radius + 15);
    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n.id === org.id) continue;
      
      const distSq = MathUtils.toroidalDistanceSq(org.position, n.position);

      if (n.type === EntityType.OBSTACLE) {
        const obs = this.obstacles.get(n.id);
        if (obs) {
          const minDist = org.radius + obs.radius;
          if (distSq < minDist * minDist) {
            const collisionVec = MathUtils.toroidalVector(n.position, org.position);
            const norm = MathUtils.normalize(collisionVec);
            const dot = org.velocity.x * norm.x + org.velocity.y * norm.y + org.velocity.z * norm.z;
            org.velocity.x -= 2 * dot * norm.x;
            org.velocity.y -= 2 * dot * norm.y;
            org.velocity.z -= 2 * dot * norm.z;
            
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            org.position.x += norm.x * overlap;
            org.position.y += norm.y * overlap;
            org.position.z += norm.z * overlap;
          }
        }
        continue;
      }

      const minDist = org.radius + (n.type === EntityType.FOOD ? 5 : 6);
      
      if (distSq < minDist * minDist) {
        if (n.type === EntityType.FOOD) {
          if (org.type === EntityType.PREY) {
            org.energy += 45; 
            this.emit({ type: 'EntityDied', id: n.id, entityType: EntityType.FOOD });
            this.food.delete(n.id);
          }
        } else {
          const other = this.organisms.get(n.id);
          if (other) {
             if (org.type === EntityType.PREDATOR && other.type === EntityType.PREY) {
               org.energy += Math.max(20, other.energy * 0.7);
               other.die();
             }
          }
        }
      }
    }
  }

  private calculateStats(): SimulationStats {
    let prey = 0;
    let pred = 0;
    let energySum = 0;
    let count = 0;
    
    this.organisms.forEach(o => {
      if (o.type === EntityType.PREY) prey++;
      else pred++;
      if (!isNaN(o.energy)) {
        energySum += o.energy;
        count++;
      }
    });

    return {
      preyCount: prey,
      predatorCount: pred,
      foodCount: this.food.size,
      avgEnergy: count > 0 ? energySum / count : 0,
      generation: 0,
      maxAge: this.stats_maxAge,
      totalDeaths: this.stats_totalDeaths
    };
  }
}
