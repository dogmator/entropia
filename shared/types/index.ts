/**
 * Entropia 3D — Центральний експорт типів.
 *
 * Реекспортує всі типи з модулів shared/types для зручного імпорту.
 *
 * @example
 * import { OrganismId, Vector3, SimulationConfig } from '@shared/types';
 *
 * @module shared/types
 */

// Branded Types (ідентифікатори)
export type {
  Brand,
  OrganismId,
  FoodId,
  ObstacleId,
  GenomeId,
  EntityId,
} from './brands';

export {
  createOrganismId,
  createFoodId,
  createObstacleId,
  createGenomeId,
} from './brands';

// Вектори
export type { Vector3, MutableVector3 } from './vectors';

export {
  vec3,
  vec3Zero,
  vec3Clone,
  vec3Length,
  vec3Normalize,
  vec3Distance,
  vec3Add,
  vec3Sub,
  vec3Scale,
} from './vectors';

// Переліки
export {
  EntityType,
  PredatorSubtype,
  OrganismState,
  ZoneType,
  GraphicsQuality,
} from './enums';

// Генетика
export type { PreyGenome, PredatorGenome, Genome } from './genome';
export { isPreyGenome, isPredatorGenome } from './genome';

// Конфігурація
export type {
  WorldConfig,
  VisConfig,
  PhysicsConfig,
  SimulationConfig,
} from './config';

// Події
export type {
  EntitySpawnedEvent,
  EntityDiedEvent,
  EntityReproducedEvent,
  TickUpdatedEvent,
  CollisionEvent,
  CauseOfDeath,
  SimulationEvent,
  SimulationEventCallback,
} from './events';

// Статистика
export type {
  PerformanceMetrics,
  SimulationStats,
  PopulationSnapshot,
  PopulationDataPoint,
} from './stats';

// Рендеринг
export type {
  RenderBuffers,
  OrganismRenderData,
  FoodRenderData,
  ObstacleRenderData,
  RenderFrame,
} from './render';

// Сутності
export type {
  GridEntity,
  EcologicalZone,
  GeneticTreeNode,
  GeneticTree,
} from './entities';
