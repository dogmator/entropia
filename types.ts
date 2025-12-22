
/**
 * Entropia 3D — Основні визначення типів
 *
 * Академічно сувора типізація з використанням:
 * - Branded Types для безпечних ідентифікаторів
 * - Readonly модифікаторів для імутабельності
 * - Discriminated Unions для безпечного pattern matching
 * - Const assertions для літеральних типів
 */

// ============================================================================
// BRANDED TYPES — Типобезпечні ідентифікатори
// ============================================================================

declare const __brand: unique symbol;

/**
 * Патерн Branded type — запобігає змішуванню різних ID
 * @example
 * const orgId: OrganismId = "123" as OrganismId;
 * const foodId: FoodId = "123" as FoodId;
 * // orgId === foodId — помилка компіляції!
 */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

export type OrganismId = Brand<string, 'OrganismId'>;
export type FoodId = Brand<string, 'FoodId'>;
export type ObstacleId = Brand<string, 'ObstacleId'>;
export type GenomeId = Brand<string, 'GenomeId'>;
export type EntityId = OrganismId | FoodId | ObstacleId;

/** Безпечне створення типізованих ID */
export const createOrganismId = (id: string): OrganismId => id as OrganismId;
export const createFoodId = (id: string): FoodId => id as FoodId;
export const createObstacleId = (id: string): ObstacleId => id as ObstacleId;
export const createGenomeId = (id: string): GenomeId => id as GenomeId;

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const EntityType = {
  PREY: 'PREY',
  PREDATOR: 'PREDATOR',
  FOOD: 'FOOD',
  OBSTACLE: 'OBSTACLE',
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

/** Підтипи хижаків для спеціалізації */
export const PredatorSubtype = {
  HUNTER: 'HUNTER',       // Швидкий, слабкий
  AMBUSHER: 'AMBUSHER',   // Повільний, сильний
  PACK: 'PACK',           // Середній, соціальний
} as const;

export type PredatorSubtype = typeof PredatorSubtype[keyof typeof PredatorSubtype];

// ============================================================================
// ВЕКТОРНА МАТЕМАТИКА
// ============================================================================

/**
 * Імутабельний 3D Вектор
 * Усі операції повертають новий вектор
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Mutable версія для внутрішніх обчислень двигуна (Engine) */
export interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

/** Створення нового вектора */
export const vec3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
export const vec3Zero = (): MutableVector3 => ({ x: 0, y: 0, z: 0 });
export const vec3Clone = (v: Vector3): MutableVector3 => ({ x: v.x, y: v.y, z: v.z });

// ============================================================================
// GENOME — Генетична інформація
// ============================================================================

/**
 * Базовий геном зі спільними характеристиками
 */
interface BaseGenome {
  readonly id: GenomeId;
  readonly parentId: GenomeId | null;  // Для генеалогічного дерева
  readonly generation: number;          // Покоління від пращура
  readonly color: number;
  readonly maxSpeed: number;
  readonly senseRadius: number;
  readonly metabolism: number;
  readonly size: number;

  // Візуальні мутації
  readonly asymmetry: number;     // 0-1, впливає на форму
  readonly spikiness: number;     // 0-1, кількість "шипів"
  readonly glowIntensity: number; // 0-1, інтенсивність свічення
}

/**
 * Discriminated Union для типобезпечного геному
 */
export interface PreyGenome extends BaseGenome {
  readonly type: typeof EntityType.PREY;
  readonly flockingStrength: number;  // Схильність до стадності
}

export interface PredatorGenome extends BaseGenome {
  readonly type: typeof EntityType.PREDATOR;
  readonly subtype: PredatorSubtype;
  readonly attackPower: number;
  readonly packAffinity: number;      // Схильність до зграйності
}

export type Genome = PreyGenome | PredatorGenome;

/** Type guard для безпечної перевірки типу */
export const isPreyGenome = (g: Genome): g is PreyGenome => g.type === EntityType.PREY;
export const isPredatorGenome = (g: Genome): g is PredatorGenome => g.type === EntityType.PREDATOR;

// ============================================================================
// СТАНИ СУТНОСТЕЙ (ENTITY STATES)
// ============================================================================

export const OrganismState = {
  IDLE: 'IDLE',
  SEEKING: 'SEEKING',
  FLEEING: 'FLEEING',
  HUNTING: 'HUNTING',
  REPRODUCING: 'REPRODUCING',
  DYING: 'DYING',
} as const;

export type OrganismState = typeof OrganismState[keyof typeof OrganismState];

// ============================================================================
// СТАТИСТИКА
// ============================================================================

/**
 * Метрики продуктивності симуляції
 */
export interface PerformanceMetrics {
  readonly fps: number;              // Frames Per Second
  readonly tps: number;              // Ticks Per Second (швидкість симуляції)
  readonly frameTime: number;        // Час рендерингу кадру (ms)
  readonly simulationTime: number;   // Час обчислення симуляції (ms)
  readonly entityCount: number;      // Загальна кількість сутностей
  readonly drawCalls: number;        // Кількість draw calls
}

export interface SimulationStats {
  readonly preyCount: number;
  readonly predatorCount: number;
  readonly foodCount: number;
  readonly avgEnergy: number;
  readonly avgPreyEnergy: number;
  readonly avgPredatorEnergy: number;
  readonly generation: number;
  readonly maxGeneration: number;
  readonly maxAge: number;
  readonly totalDeaths: number;
  readonly totalBirths: number;
  readonly extinctionRisk: number;    // 0-1, ризик вимирання
  readonly performance?: PerformanceMetrics; // Опціональні метрики продуктивності
}

export interface PopulationSnapshot {
  readonly tick: number;
  readonly prey: number;
  readonly predators: number;
  readonly food: number;
  readonly avgEnergy: number;
}

/** Тип для історії популяції (використовується в графіках) */
export interface PopulationDataPoint {
  readonly time: number;
  readonly prey: number;
  readonly pred: number;
  readonly food?: number;
}

// ============================================================================
// КОНФІГУРАЦІЯ
// ============================================================================

export interface VisConfig {
  readonly organismOpacity: number;
  readonly foodOpacity: number;
  readonly organismScale: number;
  readonly foodScale: number;
  readonly gridOpacity: number;
  readonly bloomIntensity: number;
  readonly trailLength: number;
  readonly showEnergyGlow: boolean;
}

export interface PhysicsConfig {
  readonly drag: number;
  readonly separationWeight: number;
  readonly alignmentWeight: number;
  readonly cohesionWeight: number;
  readonly seekWeight: number;
  readonly avoidWeight: number;
}

export interface SimulationConfig extends VisConfig, PhysicsConfig {
  readonly foodSpawnRate: number;
  readonly maxFood: number;
  readonly maxOrganisms: number;
  readonly showObstacles: boolean;
  readonly showOrbitalSatellites: boolean; // Показувати орбітальні супутники біля їжі
  readonly mutationFactor: number;
  readonly reproductionThreshold: number;
}

// ============================================================================
// EVENTS — Discriminated Union для подій симуляції
// ============================================================================

export interface EntitySpawnedEvent {
  readonly type: 'EntitySpawned';
  readonly entityType: EntityType;
  readonly id: EntityId;
  readonly position: Vector3;
  readonly parentId?: OrganismId;
}

export interface EntityDiedEvent {
  readonly type: 'EntityDied';
  readonly entityType: EntityType;
  readonly id: EntityId;
  readonly position: Vector3;
  readonly causeOfDeath: 'starvation' | 'predation' | 'old_age';
}

export interface EntityReproducedEvent {
  readonly type: 'EntityReproduced';
  readonly parentId: OrganismId;
  readonly childId: OrganismId;
  readonly position: Vector3;
  readonly generation: number;
}

export interface TickUpdatedEvent {
  readonly type: 'TickUpdated';
  readonly tick: number;
  readonly stats: SimulationStats;
  readonly deltaTime: number;
}

export interface CollisionEvent {
  readonly type: 'Collision';
  readonly entityA: EntityId;
  readonly entityB: EntityId;
  readonly position: Vector3;
}

export type SimulationEvent =
  | EntitySpawnedEvent
  | EntityDiedEvent
  | EntityReproducedEvent
  | TickUpdatedEvent
  | CollisionEvent;

// ============================================================================
// ПРОСТОРОВА СІТКА (SPATIAL GRID)
// ============================================================================

export interface GridEntity {
  readonly id: EntityId;
  readonly position: Vector3;
  readonly type: EntityType;
  readonly radius: number;
}

// ============================================================================
// RENDER DATA — Дані для передачі в рендер
// ============================================================================

/**
 * Структура даних для рендерингу InstancedMesh
 * Оптимізована для передачі в GPU
 */
export interface OrganismRenderData {
  readonly id: OrganismId;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly radius: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly type: EntityType;
  readonly state: OrganismState;
  readonly genome: Genome;
  readonly trailEnabled: boolean;
  readonly age: number;
}

export interface FoodRenderData {
  readonly id: FoodId;
  readonly position: Vector3;
  readonly radius: number;
  readonly energyValue: number;
}

export interface ObstacleRenderData {
  readonly id: ObstacleId;
  readonly position: Vector3;
  readonly radius: number;
  readonly color: number;
  readonly opacity: number;
}

export interface RenderFrame {
  readonly tick: number;
  readonly organisms: readonly OrganismRenderData[];
  readonly food: readonly FoodRenderData[];
  readonly obstacles: readonly ObstacleRenderData[];
  readonly events: readonly SimulationEvent[];
  readonly stats: SimulationStats;
}

// ============================================================================
// ЕКОЛОГІЧНІ ЗОНИ
// ============================================================================

export const ZoneType = {
  OASIS: 'OASIS',           // Висока концентрація їжі
  DESERT: 'DESERT',         // Низька концентрація їжі
  HUNTING_GROUND: 'HUNTING_GROUND',  // Бонус для хижаків
  SANCTUARY: 'SANCTUARY',   // Захист від хижаків
} as const;

export type ZoneType = typeof ZoneType[keyof typeof ZoneType];

export interface EcologicalZone {
  readonly id: string;
  readonly type: ZoneType;
  readonly center: Vector3;
  readonly radius: number;
  readonly foodMultiplier: number;
  readonly dangerMultiplier: number;
}

// ============================================================================
// ГЕНЕТИЧНЕ ДЕРЕВО (GENETIC TREE)
// ============================================================================

export interface GeneticTreeNode {
  readonly id: GenomeId;
  readonly parentId: GenomeId | null;
  readonly children: readonly GenomeId[];
  readonly generation: number;
  readonly born: number;      // тік (tick)
  readonly died: number | null;
  readonly type: EntityType;
  readonly traits: {
    readonly speed: number;
    readonly sense: number;
    readonly size: number;
  };
}

export interface GeneticTree {
  readonly nodes: ReadonlyMap<GenomeId, GeneticTreeNode>;
  readonly roots: readonly GenomeId[];
  readonly maxGeneration: number;
}
