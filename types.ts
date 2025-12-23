/**
 * Entropia 3D — Центральний реєстр детермінованих визначень типів.
 *
 * Реалізує принципи академічно суворої типізації з використанням:
 * - Branded Types для забезпечення фізичної сегрегації ідентифікаторів.
 * - Модифікаторів імутабельності (Readonly) для гарантування цілісності даних.
 * - Дискримінаційних об'єднань (Discriminated Unions) для безпечного зіставлення за зразком.
 * - Статичних константних асерцій для детермінації літеральних просторів.
 */

// ============================================================================
// BRANDED TYPES — ТИПОБЕЗПЕЧНІ ІДЕНТИФІКАТОРИ
// ============================================================================

declare const __brand: unique symbol;

/**
 * Патерн «Branded Type» — запобігає семантичному змішуванню ідентифікаторів різних доменів.
 * 
 * @example
 * const orgId: OrganismId = "123" as OrganismId;
 * const foodId: FoodId = "123" as FoodId;
 * // Операція (orgId === foodId) ініціює помилку компіляції!
 */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

export type OrganismId = Brand<string, 'OrganismId'>;
export type FoodId = Brand<string, 'FoodId'>;
export type ObstacleId = Brand<string, 'ObstacleId'>;
export type GenomeId = Brand<string, 'GenomeId'>;
export type EntityId = OrganismId | FoodId | ObstacleId;

/** Фабричні методи для безпечної інстанціації типізованих дескрипторів. */
export const createOrganismId = (id: string): OrganismId => id as OrganismId;
export const createFoodId = (id: string): FoodId => id as FoodId;
export const createObstacleId = (id: string): ObstacleId => id as ObstacleId;
export const createGenomeId = (id: string): GenomeId => id as GenomeId;

// ============================================================================
// ПЕРЕЛІКИ ТА ДЕТЕРМІНОВАНІ КОНСТАНТИ
// ============================================================================

export const EntityType = {
  PREY: 'PREY',
  PREDATOR: 'PREDATOR',
  FOOD: 'FOOD',
  OBSTACLE: 'OBSTACLE',
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

/** Класифікація еволюційних підтипів хижих суб'єктів. */
export const PredatorSubtype = {
  HUNTER: 'HUNTER',       // Спеціалізація: Швидкість / Низька витривалість
  AMBUSHER: 'AMBUSHER',   // Спеціалізація: Латентність / Висока ударна потужність
  PACK: 'PACK',           // Спеціалізація: Соціальна кооперування
} as const;

export type PredatorSubtype = typeof PredatorSubtype[keyof typeof PredatorSubtype];

/** Рівні інтенсивності графічної репрезентації. */
export const GraphicsQuality = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  ULTRA: 'ULTRA',
  CUSTOM: 'CUSTOM', // Параметри, визначені користувачем
} as const;

export type GraphicsQuality = typeof GraphicsQuality[keyof typeof GraphicsQuality];

// ============================================================================
// ОБ'ЄКТИ ВЕКТОРНОГО АНАЛІЗУ
// ============================================================================

/**
 * Імутабельний тривимірний вектор (Euclidean Vector).
 * Усі математичні трансформації повертають нову проекцію.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Версія вектора з можливістю мутації для ітераційних обчислень (Engine Internal). */
export interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

/** Допоміжні методи для маніпуляції векторіальними даними. */
export const vec3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
export const vec3Zero = (): MutableVector3 => ({ x: 0, y: 0, z: 0 });
export const vec3Clone = (v: Vector3): MutableVector3 => ({ x: v.x, y: v.y, z: v.z });

// ============================================================================
// GENOME — ГЕНЕТИЧНА ДЕТЕРМІНАЦІЯ
// ============================================================================

/**
 * Базовий дескриптор геному з інваріантними характеристиками.
 */
interface BaseGenome {
  readonly id: GenomeId;
  readonly parentId: GenomeId | null;  // Посилання для філогенетичного аналізу
  readonly generation: number;          // Порядковий номер реплікації
  readonly color: number;
  readonly maxSpeed: number;
  readonly senseRadius: number;
  readonly metabolism: number;
  readonly size: number;

  // Генетично обумовлені морфологічні ознаки
  readonly asymmetry: number;     // Коефіцієнт деформації форми (0-1)
  readonly spikiness: number;     // Ступінь вираженості структурних виступів (0-1)
  readonly glowIntensity: number; // Амплітуда візуальної емісії енергії (0-1)
}

/**
 * Дискримінаційне об'єднання для забезпечення строгості генетичного коду.
 */
export interface PreyGenome extends BaseGenome {
  readonly type: typeof EntityType.PREY;
  readonly flockingStrength: number;  // Схильність до групової агрегації
}

export interface PredatorGenome extends BaseGenome {
  readonly type: typeof EntityType.PREDATOR;
  readonly subtype: PredatorSubtype;
  readonly attackPower: number;
  readonly packAffinity: number;      // Ступінь схильності до формування зграй
}

export type Genome = PreyGenome | PredatorGenome;

/** Механізми предикатної перевірки типу геному. */
export const isPreyGenome = (g: Genome): g is PreyGenome => g.type === EntityType.PREY;
export const isPredatorGenome = (g: Genome): g is PredatorGenome => g.type === EntityType.PREDATOR;

// ============================================================================
// ФАЗОВІ СТАНИ СУТНОСТЕЙ (ENTITY STATES)
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
// МЕТРИКИ ТА СТАТИСТИЧНИЙ АНАЛІЗ
// ============================================================================

/**
 * Показники продуктивності обчислювального конвеєра.
 */
export interface PerformanceMetrics {
  readonly fps: number;              // Частота оновлення кадрів (Frames Per Second)
  readonly tps: number;              // Частота оновлення фізики (Ticks Per Second)
  readonly frameTime: number;        // Латентність рендерингу кадру (мс)
  readonly simulationTime: number;   // Тривалість обчислювального такту (мс)
  readonly entityCount: number;      // Сумарна популяційна чисельність
  readonly drawCalls: number;        // Кількість викликів відмальовування
}

/**
 * Комплексні статистичні показники стану біосфери.
 */
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
  readonly extinctionRisk: number;    // Імовірність колапсу екосистеми (0-1)
  readonly performance?: PerformanceMetrics;
}

export interface PopulationSnapshot {
  readonly tick: number;
  readonly prey: number;
  readonly predators: number;
  readonly food: number;
  readonly avgEnergy: number;
}


/** Структура порцій даних для динамічної візуалізації графіків. */
export interface PopulationDataPoint {
  readonly time: number;
  readonly prey: number;
  readonly pred: number;
  readonly food?: number;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export type JsonArray = JsonValue[];

export interface SerializedVector3 {
  x: number;
  y: number;
  z: number;
}

export interface SerializedGenomeBase {
  id: string;
  parentId: string | null;
  generation: number;
  color: number;
  maxSpeed: number;
  senseRadius: number;
  metabolism: number;
  size: number;
  asymmetry: number;
  spikiness: number;
  glowIntensity: number;
}

export interface SerializedPreyGenome extends SerializedGenomeBase {
  type: typeof EntityType.PREY;
  flockingStrength: number;
}

export interface SerializedPredatorGenome extends SerializedGenomeBase {
  type: typeof EntityType.PREDATOR;
  subtype: PredatorSubtype;
  attackPower: number;
  packAffinity: number;
}

export type SerializedGenome = SerializedPreyGenome | SerializedPredatorGenome;

export interface SerializedOrganism {
  id: string;
  type: typeof EntityType.PREY | typeof EntityType.PREDATOR;
  position: SerializedVector3;
  velocity: SerializedVector3;
  acceleration: SerializedVector3;
  radius: number;
  energy: number;
  age: number;
  state: OrganismState;
  isDead: boolean;
  causeOfDeath: 'starvation' | 'predation' | 'old_age' | null;
  trailEnabled: boolean;
  parentOrganismId: string | null;
  huntSuccessCount: number;
  lastActiveAt: number;
  genome: SerializedGenome;
}

export interface SerializedFood {
  id: string;
  position: SerializedVector3;
  radius: number;
  energyValue: number;
  spawnTime: number;
  consumed: boolean;
}

export interface SerializedObstacle {
  id: string;
  position: SerializedVector3;
  radius: number;
  color: number;
  opacity: number;
  isWireframe: boolean;
}

export interface SerializedEcologicalZone {
  id: string;
  type: ZoneType;
  center: SerializedVector3;
  radius: number;
  foodMultiplier: number;
  dangerMultiplier: number;
}

export interface SerializedGeneticTreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  generation: number;
  born: number;
  died: number | null;
  type: EntityType;
  traits: {
    speed: number;
    sense: number;
    size: number;
  };
}

export interface SerializedSimulationStateV1 {
  version: 1;
  seed: number;
  rngState: number;
  tick: number;
  counters: {
    foodIdCounter: number;
    obstacleIdCounter: number;
    organismIdCounter: number;
    genomeIdCounter: number;
  };
  stats: {
    totalDeaths: number;
    totalBirths: number;
    maxAge: number;
    maxGeneration: number;
  };
  config: SimulationConfig;
  zones: SerializedEcologicalZone[];
  obstacles: SerializedObstacle[];
  food: SerializedFood[];
  organisms: SerializedOrganism[];
  geneticTree: {
    roots: string[];
    nodes: SerializedGeneticTreeNode[];
  };
}

// ============================================================================
// ПАРАМЕТРИ КОНФІГУРАЦІЇ
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
  readonly showTrails: boolean;         // Активація візуальних треків руху
  readonly showParticles: boolean;      // Активація фонових та ефектних систем часток
  readonly graphicsQuality: GraphicsQuality;
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
  readonly mutationFactor: number;
  readonly reproductionThreshold: number;
}

// ============================================================================
// EVENTS — СИСТЕМА ДИСКРИМІНАЦІЙНИХ ПОВІДОМЛЕНЬ
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
// SPATIAL GRID — ПРОСТОРОВА ДЕКОМПОЗИЦІЯ
// ============================================================================

export interface GridEntity {
  readonly id: EntityId;
  readonly position: Vector3;
  readonly type: EntityType;
  readonly radius: number;
}

// ============================================================================
// WEB WORKER & OPTIMIZATION TYPES (Low-level Data Transfer)
// ============================================================================

export interface RenderBuffers {
  /**
   * Flat Float32Array containing data for all PREY organisms.
   * Stride: 13 floats per entity
   * [0-2] position (x, y, z)
   * [3-5] velocity (x, y, z)
   * [6] radius
   * [7] rotation (derived from velocity, placeholder if needed)
   * [8] id (cast to float, potential precision loss if IDs are huge, but fine for local counters)
   * [9-12] reserved / alignment
   */
  prey: Float32Array;
  preyCount: number;

  /**
   * Flat Float32Array containing data for all PREDATOR organisms.
   * Stride: 13 floats per entity
   */
  predators: Float32Array;
  predatorCount: number;

  /**
   * Flat Float32Array containing data for all FOOD items.
   * Stride: 4 floats per entity
   * [0-2] position (x, y, z)
   * [3] radius/scale (derived from radius)
   */
  food: Float32Array;
  foodCount: number;
}


/**
 * Оптимізована структура даних для конфігурації InstancedMesh (GPU).
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

/** Агрегований стан кадру для термінального рендерингу. */
export interface RenderFrame {
  readonly tick: number;
  readonly organisms: readonly OrganismRenderData[];
  readonly food: readonly FoodRenderData[];
  readonly obstacles: readonly ObstacleRenderData[];
  readonly events: readonly SimulationEvent[];
  readonly stats: SimulationStats;
}

// ============================================================================
// ЕКОЛОГІЧНІ ЗОНИ ТА БІОМИ
// ============================================================================

export const ZoneType = {
  OASIS: 'OASIS',           // Регіон високої проліферації ресурсів
  DESERT: 'DESERT',         // Регіон енергетичного дефіциту
  HUNTING_GROUND: 'HUNTING_GROUND',  // Територія з перевагою для консументів
  SANCTUARY: 'SANCTUARY',   // Рефугіум (захищена зона для травоїдних)
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
// ГЕНЕТИЧНА КОМПАРАТИВІСТИКА (GENETIC TREE)
// ============================================================================

export interface GeneticTreeNode {
  readonly id: GenomeId;
  readonly parentId: GenomeId | null;
  readonly children: readonly GenomeId[];
  readonly generation: number;
  readonly born: number;      // Часова відмітка (tick) появи
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

/**
 * Конфігурація фізичних параметрів світу, що підтримує масштабування.
 */
export interface WorldConfig {
  /** Лінійна розмірність кубічного домену. */
  readonly WORLD_SIZE: number;
  /** Гранично допустима сумарна чисельність агентів. */
  readonly MAX_TOTAL_ORGANISMS: number;
  /** Початкова кількість травоїдних. */
  readonly INITIAL_PREY: number;
  /** Початкова кількість хижаків. */
  readonly INITIAL_PREDATOR: number;
  /** Максимальна кількість їжі. */
  readonly MAX_FOOD: number;
  /** Швидкість респавну їжі. */
  readonly FOOD_SPAWN_RATE: number;
}


