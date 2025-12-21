
export enum EntityType {
  PREY = 'PREY',
  PREDATOR = 'PREDATOR',
  FOOD = 'FOOD',
  OBSTACLE = 'OBSTACLE'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Genome {
  readonly id: string;
  readonly type: EntityType;
  readonly color: number;
  readonly maxSpeed: number;
  readonly senseRadius: number;
  readonly metabolism: number;
  readonly size: number;
}

export interface SimulationStats {
  preyCount: number;
  predatorCount: number;
  foodCount: number;
  avgEnergy: number;
  generation: number;
  maxAge: number;
  totalDeaths: number;
}

export interface VisConfig {
  organismOpacity: number;
  foodOpacity: number;
  organismScale: number;
  foodScale: number;
  gridOpacity: number;
}

export interface SimulationConfig extends VisConfig {
  foodSpawnRate: number;
  maxFood: number;
  mutationFactor: number;
  reproductionThreshold: number;
  physicsDrag: number;
  separationWeight: number;
  seekWeight: number;
  avoidWeight: number;
}

export type SimulationEvent = 
  | { type: 'EntitySpawned'; entity: any }
  | { type: 'EntityDied'; id: string; entityType: EntityType }
  | { type: 'TickUpdated'; stats: SimulationStats };
