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
  Food,
  GenomeFactory,
  isFood,
  isObstacle,
  isOrganism,
  isPredator,
  isPrey,
  Obstacle,
  Organism,
  OrganismFactory,
} from './Entity';

// Просторова сітка
export { SpatialHashGrid } from './SpatialHashGrid';

// Математичні утиліти
export * from './MathUtils';

// Системи
export { BehaviorSystem } from './systems/BehaviorSystem';
export { CollisionSystem } from './systems/CollisionSystem';
export { MetabolismSystem } from './systems/MetabolismSystem';
export { PhysicsSystem } from './systems/PhysicsSystem';
export { ReproductionSystem } from './systems/ReproductionSystem';

// Сервіси
export { SpawnService } from './services/SpawnService';
