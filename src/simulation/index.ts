/**
 * Entropia 3D — Central export of the simulation module.
 *
 * Contains main simulation engine, entities, and systems.
 * This module can work independently of React (Web Worker ready).
 *
 * @module simulation
 */

// Main simulation engine
export { SimulationEngine } from './engine/Engine';

// Entities
export { Entity, Food, Obstacle, Organism } from './Entity';

// Spatial grid
export { SpatialHashGrid } from './SpatialHashGrid.service';

// Mathematical utilities
export { MathUtils } from './MathUtils.utils';

// Systems
export { BehaviorSystem } from './systems/Behavior.system';
export { CollisionSystem } from './systems/Collision.system';
export { MetabolismSystem } from './systems/Metabolism.system';
export { PhysicsSystem } from './systems/Physics.system';
export { ReproductionSystem } from './systems/Reproduction.system';

// Services
export { BufferManager } from './services/BufferManager.manager';
export { SpawnService } from './services/Spawn.service';

// Web Worker interface
export * from './WorkerMessages';
