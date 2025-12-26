/**
 * Entropia 3D — Центральний експорт simulation модуля.
 *
 * Містить основний двигун симуляції, сутності та системи.
 * Цей модуль може працювати незалежно від React (Web Worker ready).
 *
 * @module simulation
 */

// Головний двигун симуляції
export { SimulationEngine } from './Engine';

// Сутності
export {
  Entity,
  Organism,
  Food,
  Obstacle,
  GenomeFactory,
  OrganismFactory,
  isOrganism,
  isFood,
  isObstacle,
  isPrey,
  isPredator,
} from './Entity';

// Просторова сітка
export { SpatialHashGrid } from './SpatialHashGrid';

// Математичні утиліти
export * from './MathUtils';

// Системи
export { PhysicsSystem } from './systems/PhysicsSystem';
export { MetabolismSystem } from './systems/MetabolismSystem';
export { CollisionSystem } from './systems/CollisionSystem';
export { BehaviorSystem } from './systems/BehaviorSystem';
export { ReproductionSystem } from './systems/ReproductionSystem';

// Сервіси
export { SpawnService } from './services/SpawnService';
