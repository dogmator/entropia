/**
 * Entropia 3D — Модернізоване ядро симуляційного двигуна.
 *
 * Виступає як центральний оркестратор спеціалізованих систем, реалізований на засадах чистой архітектури:
 * - EventBus - шина подій для забезпечення низької зв'язності компонентів.
 * - BehaviorSystem - підсистема моделювання логіки поведінки та прийняття рішень (AI).
 * - PhysicsSystem - обчислювальний модуль кінематики та динаміки руху.
 * - MetabolismSystem - система термодинамічного моделювання енергетичного балансу.
 * - CollisionSystem - алгоритми детектування та обробки просторових інтерференцій.
 * - ReproductionSystem - механізми генетичного наслідування та популяційної динаміки.
 */

import {
  EntityType,
  EntityId,
  OrganismId,
  FoodId,
  SimulationEvent,
  SimulationStats,
  SimulationConfig,
  WorldConfig,
  EcologicalZone,
  ZoneType,
  GeneticTreeNode,
  GenomeId,
  SerializedSimulationStateV1,
  SerializedGenome,
  SerializedOrganism,
  SerializedFood,
  SerializedObstacle,
  SerializedEcologicalZone,
  SerializedGeneticTreeNode,
  createFoodId,
  createObstacleId,
  createOrganismId,
  createGenomeId,
} from '../types';
import {
  INITIAL_VIS_CONFIG,
  ZONE_DEFAULTS,
  GENETICS,
  PHYSICS,
  REPRODUCTION_ENERGY_THRESHOLD,
  createWorldConfig, // Added
} from '../constants';
import { Organism, Food, Obstacle } from './Entity';
import { SpatialHashGrid } from './SpatialHashGrid';
import { PerformanceMetrics } from '../types';
import { PerformanceHelpers } from '../core/utils/PerformanceUtils';
import type { MemoryInfo } from '../core/utils/PerformanceUtils';
import { logger } from '../core/services/Logger';
import { EventBus } from '../core/EventBus';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { MetabolismSystem } from './systems/MetabolismSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { BehaviorSystem } from './systems/BehaviorSystem';
import { ReproductionSystem } from './systems/ReproductionSystem';
import { SpawnService } from './services/SpawnService';
import { Random } from '../core/utils/Random';
import { PerformanceMonitor } from '../core/services/PerformanceMonitor';

// ============================================================================
// ПРЕДСТАВНИЦТВО ОСНОВНОГО КЛАСУ ДВИГУНА
// ============================================================================

export class SimulationEngine {
  // Дескриптори колекцій віртуальних сутностей
  public readonly organisms: Map<string, Organism> = new Map();
  public readonly food: Map<string, Food> = new Map();
  public readonly obstacles: Map<string, Obstacle> = new Map();
  public readonly zones: Map<string, EcologicalZone> = new Map();

  // Структури збереження філогенетичних зв'язків
  public readonly geneticTree: Map<GenomeId, GeneticTreeNode> = new Map();
  public readonly geneticRoots: GenomeId[] = [];

  // Ініціалізація функціональних підсистем
  private readonly eventBus: EventBus;
  private readonly spatialGrid: SpatialHashGrid;
  private readonly physicsSystem: PhysicsSystem;
  private readonly metabolismSystem: MetabolismSystem;
  private readonly collisionSystem: CollisionSystem;
  private readonly behaviorSystem: BehaviorSystem;
  private readonly reproductionSystem: ReproductionSystem;

  // Модулі сервісної підтримки
  private readonly spawnService: SpawnService;
  private readonly performanceMonitor: PerformanceMonitor;

  // Системні лічильники та часова дискретизація
  private foodIdCounter: number = 0;
  private obstacleIdCounter: number = 0;
  private tick: number = 0;

  private readonly rng: Random;
  private seed: number;

  // Метрики статистичного аналізу
  private stats: SimulationStats = {
    preyCount: 0,
    predatorCount: 0,
    foodCount: 0,
    avgEnergy: 0,
    avgPreyEnergy: 0,
    avgPredatorEnergy: 0,
    generation: 0,
    maxGeneration: 1,
    maxAge: 0,
    totalDeaths: 0,
    totalBirths: 0,
    extinctionRisk: 0,
  };

  // Реєстр конфігураційних параметрів
  public config: SimulationConfig;
  public worldConfig: WorldConfig;

  constructor(scale: number = 1.0) {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = new Random(this.seed);
    this.worldConfig = createWorldConfig(scale);
    this.config = this.createDefaultConfig();

    logger.info('Initializing SimulationEngine', 'Engine', { 
      seed: this.seed, 
      scale, 
      worldSize: this.worldConfig.WORLD_SIZE 
    });

    // Комплексна ініціалізація системних компонентів
    this.eventBus = new EventBus();
    this.spatialGrid = new SpatialHashGrid(this.worldConfig.WORLD_SIZE);
    this.physicsSystem = new PhysicsSystem(this.config, this.worldConfig);
    this.metabolismSystem = new MetabolismSystem();
    this.collisionSystem = new CollisionSystem(this.spatialGrid, this.eventBus);
    this.behaviorSystem = new BehaviorSystem(this.spatialGrid, this.config, this.zones, this.worldConfig);

    // Попереднє формування середовищних параметрів
    this.createZones();
    this.createObstacles();

    // Агрегація сервісних модулів
    this.spawnService = new SpawnService(
      this.eventBus,
      this.spatialGrid,
      this.zones,
      this.obstacles,
      this.rng,
      {},
      this.worldConfig // Passed WorldConfig
    );

    // Ініціалізація монітора продуктивності
    this.performanceMonitor = new PerformanceMonitor();
    logger.info('PerformanceMonitor initialized', 'Engine');

    // Налаштування системи репродукції з інтеграцією фабрики об'єктів
    this.reproductionSystem = new ReproductionSystem(
      this.config,
      this.spawnService.getFactory(),
      this.eventBus,
      this.geneticTree,
      this.geneticRoots,
      this.tick
    );

    // Генерація початкових популяційних масивів
    this.createInitialPopulation();
  }

  // ============================================================================
  // МЕТОДИ ІНІЦІАЛІЗАЦІЇ ТА ФОРМУВАННЯ СЕРЕДОВИЩА
  // ============================================================================

  /**
   * Генерація базового набору конфігураційних значень.
   */
  private createDefaultConfig(): SimulationConfig {
    return {
      foodSpawnRate: this.worldConfig.FOOD_SPAWN_RATE,
      maxFood: this.worldConfig.MAX_FOOD,
      maxOrganisms: this.worldConfig.MAX_TOTAL_ORGANISMS,
      showObstacles: true,
      mutationFactor: GENETICS.mutationFactor,
      reproductionThreshold: REPRODUCTION_ENERGY_THRESHOLD,
      drag: PHYSICS.drag,
      separationWeight: PHYSICS.separationWeight,
      alignmentWeight: PHYSICS.alignmentWeight,
      cohesionWeight: PHYSICS.cohesionWeight,
      seekWeight: PHYSICS.seekWeight,
      avoidWeight: PHYSICS.avoidWeight,
      ...INITIAL_VIS_CONFIG,
    };
  }

  /**
   * Просторова розмітка та ініціалізація екологічних зон.
   */
  private createZones(): void {
    const ws = this.worldConfig.WORLD_SIZE;
    this.zones.set('oasis_center', {
      id: 'oasis_center',
      type: ZoneType.OASIS,
      center: { x: ws / 2, y: ws / 2, z: ws / 2 },
      radius: ws * 0.15,
      foodMultiplier: ZONE_DEFAULTS.OASIS.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.OASIS.dangerMultiplier,
    });

    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: ws, y: ws, z: ws },
    ];
    corners.forEach((pos, i) => {
      this.zones.set(`desert_${i}`, {
        id: `desert_${i}`,
        type: ZoneType.DESERT,
        center: pos,
        radius: ws * 0.2,
        foodMultiplier: ZONE_DEFAULTS.DESERT.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.DESERT.dangerMultiplier,
      });
    });

    this.zones.set('hunting_ground', {
      id: 'hunting_ground',
      type: ZoneType.HUNTING_GROUND,
      center: { x: ws * 0.75, y: ws / 2, z: ws * 0.25 },
      radius: ws * 0.12,
      foodMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.dangerMultiplier,
    });

    this.zones.set('sanctuary', {
      id: 'sanctuary',
      type: ZoneType.SANCTUARY,
      center: { x: ws * 0.25, y: ws / 2, z: ws * 0.75 },
      radius: ws * 0.1,
      foodMultiplier: ZONE_DEFAULTS.SANCTUARY.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.SANCTUARY.dangerMultiplier,
    });
  }

  /**
   * Створення статичних геометричних перешкод у просторі.
   */
  private createObstacles(): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const radius = 12 + this.rng.next() * 25;
      const obstacle = Obstacle.create(
        ++this.obstacleIdCounter,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        radius,
        this.rng
      );
      this.obstacles.set(obstacle.id, obstacle);
    }
  }

  /**
   * Формування вихідних популяцій травоїдних та хижаків.
   */
  private createInitialPopulation(): void {
    this.spawnInitialGroup(EntityType.PREY, this.worldConfig.INITIAL_PREY);
    this.spawnInitialGroup(EntityType.PREDATOR, this.worldConfig.INITIAL_PREDATOR);
  }

  private spawnInitialGroup(type: EntityType, count: number): void {
    for (let i = 0; i < count; i++) {
      const organism = this.spawnService.spawnOrganism(type);
      if (organism) {
        this.organisms.set(organism.id, organism);
        this.reproductionSystem['addToGeneticTree'](organism, undefined);
      }
    }
  }

  // ============================================================================
  // МЕТОДИ УПРАВЛІННЯ ЖИТТЄВИМ ЦИКЛОМ ТА ПОДІЯМИ
  // ============================================================================

  /**
   * Повна реініціалізація стану симуляції.
   */
  public reset(): void {
    this.organisms.clear();
    this.food.clear();
    this.obstacles.clear();
    this.zones.clear();
    this.geneticTree.clear();
    this.geneticRoots.length = 0;
    this.spatialGrid.clear();

    this.foodIdCounter = 0;
    this.obstacleIdCounter = 0;
    this.tick = 0;
    this.stats = {
      preyCount: 0,
      predatorCount: 0,
      foodCount: 0,
      avgEnergy: 0,
      avgPreyEnergy: 0,
      avgPredatorEnergy: 0,
      generation: 0,
      maxGeneration: 1,
      maxAge: 0,
      totalDeaths: 0,
      totalBirths: 0,
      extinctionRisk: 0,
    };

    this.spawnService.resetFactory();
    this.eventBus.clearHistory();
    this.createZones();
    this.createObstacles();
    this.createInitialPopulation();
  }

  public getSeed(): number {
    return this.seed;
  }

  public setSeed(seed: number): void {
    this.seed = seed >>> 0;
    this.rng.reset(this.seed);
  }

  public exportState(): SerializedSimulationStateV1 {
    const geneticNodes: SerializedGeneticTreeNode[] = [];
    this.geneticTree.forEach((node) => {
      geneticNodes.push({
        id: String(node.id),
        parentId: node.parentId ? String(node.parentId) : null,
        children: Array.from(node.children as unknown as string[]).map(String),
        generation: node.generation,
        born: node.born,
        died: node.died,
        type: node.type,
        traits: {
          speed: node.traits.speed,
          sense: node.traits.sense,
          size: node.traits.size,
        },
      });
    });

    const zones: SerializedEcologicalZone[] = Array.from(this.zones.values()).map(z => ({
      id: z.id,
      type: z.type,
      center: this.mapVector3(z.center),
      radius: z.radius,
      foodMultiplier: z.foodMultiplier,
      dangerMultiplier: z.dangerMultiplier,
    }));

    const obstacles: SerializedObstacle[] = Array.from(this.obstacles.values()).map(o => ({
      id: String(o.id),
      position: this.mapVector3(o.position),
      radius: o.radius,
      color: o.color,
      opacity: o.opacity,
      isWireframe: o.isWireframe,
    }));

    const food: SerializedFood[] = Array.from(this.food.values()).map(f => ({
      id: String(f.id),
      position: this.mapVector3(f.position),
      radius: f.radius,
      energyValue: f.energyValue,
      spawnTime: f.spawnTime,
      consumed: f.consumed,
    }));

    const organisms: SerializedOrganism[] = Array.from(this.organisms.values()).map(o => {
      const genome: SerializedGenome = {
        ...(o.genome as unknown as SerializedGenome),
        id: String(o.genome.id),
        parentId: o.genome.parentId ? String(o.genome.parentId) : null,
      };

      return {
        id: String(o.id),
        type: o.type,
        position: this.mapVector3(o.position),
        velocity: this.mapVector3(o.velocity),
        acceleration: this.mapVector3(o.acceleration),
        radius: o.radius,
        energy: o.energy,
        age: o.age,
        state: o.state,
        isDead: o.isDead,
        causeOfDeath: o.causeOfDeath,
        trailEnabled: o.trailEnabled,
        parentOrganismId: o.parentOrganismId ? String(o.parentOrganismId) : null,
        huntSuccessCount: o.huntSuccessCount,
        lastActiveAt: o.lastActiveAt,
        genome,
      };
    });

    const factory = this.spawnService.getFactory();

    return {
      version: 1,
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tick,
      counters: {
        foodIdCounter: this.foodIdCounter,
        obstacleIdCounter: this.obstacleIdCounter,
        organismIdCounter: factory.getIdCounter(),
        genomeIdCounter: factory.getGenomeIdCounter(),
      },
      stats: {
        totalDeaths: this.stats.totalDeaths,
        totalBirths: this.stats.totalBirths,
        maxAge: this.stats.maxAge,
        maxGeneration: this.stats.maxGeneration,
      },
      config: { ...(this.config as unknown as SimulationConfig) },
      zones,
      obstacles,
      food,
      organisms,
      geneticTree: {
        roots: this.geneticRoots.map(String),
        nodes: geneticNodes,
      },
    };
  }

  // ============================================================================
  // ЕКСПОРТ ДАНИХ ДЛЯ РЕНДЕРИНГУ / WEB WORKERS
  // ============================================================================

  // Внутрішні буфери для повторного використання (мінімізація GC)
  private _preyBuffer: Float32Array = new Float32Array(0);
  private _predBuffer: Float32Array = new Float32Array(0);
  private _foodBuffer: Float32Array = new Float32Array(0);

  // Лічильник для відстеження попереднього розміру популяції
  private _lastPreyCount: number = 0;
  private _lastPredCount: number = 0;
  private _lastFoodCount: number = 0;

  /** Поріг гістерезису для запобігання частим реалокаціям (25%). */
  private static readonly SHRINK_THRESHOLD = 0.25;

  /**
   * Повертає зліпок стану симуляції, оптимізований для передачі/рендерингу.
   * Використовує Float32Array для ефективності zero-copy.
   *
   * Оптимізація: Динамічне скорочення буферів при значному зменшенні популяції.
   */
  public getRenderData(): import('../types').RenderBuffers {
    // 1. Розрахунок необхідних розмірів
    let preyCount = 0;
    let predCount = 0;

    this.organisms.forEach(o => {
      if (!o.isDead) {
        if (o.isPrey) preyCount++; else predCount++;
      }
    });

    const foodCount = this.food.size;
    let activeFoodCount = 0;
    this.food.forEach(f => {
      if (!f.consumed) activeFoodCount++;
    });


    // 2. Зміна розміру буферів з урахуванням динамічного скорочення
    const PREY_STRIDE = 13;
    const PRED_STRIDE = 13;
    const FOOD_STRIDE = 5;

    this._preyBuffer = this.ensureBufferCapacityAdaptive(
      this._preyBuffer,
      preyCount * PREY_STRIDE,
      this._lastPreyCount * PREY_STRIDE
    );
    this._predBuffer = this.ensureBufferCapacityAdaptive(
      this._predBuffer,
      predCount * PRED_STRIDE,
      this._lastPredCount * PRED_STRIDE
    );
    this._foodBuffer = this.ensureBufferCapacityAdaptive(
      this._foodBuffer,
      activeFoodCount * FOOD_STRIDE,
      this._lastFoodCount * FOOD_STRIDE
    );

    // Оновлення лічильників для наступної ітерації
    this._lastPreyCount = preyCount;
    this._lastPredCount = predCount;
    this._lastFoodCount = activeFoodCount;

    // 3. Заповнення буферів
    let preyOffset = 0;
    let predOffset = 0;

    this.organisms.forEach(o => {
      if (o.isDead) return;

      const isPrey = o.isPrey;
      const buffer = isPrey ? this._preyBuffer : this._predBuffer;
      let offset = isPrey ? preyOffset : predOffset;

      // [0-2] позиція
      buffer[offset + 0] = o.position.x;
      buffer[offset + 1] = o.position.y;
      buffer[offset + 2] = o.position.z;

      // [3-5] швидкість
      buffer[offset + 3] = o.velocity.x;
      buffer[offset + 4] = o.velocity.y;
      buffer[offset + 5] = o.velocity.z;

      // [6] радіус
      buffer[offset + 6] = o.radius;

      // [7] ротація (резерв)
      buffer[offset + 7] = 0;

      // [8] ID (числова частина для кореляції)
      const numId = parseInt(o.id.split('_')[1] || '0', 10);
      buffer[offset + 8] = numId;

      // [9-12] Резерв
      buffer[offset + 9] = 0;
      buffer[offset + 10] = 0;
      buffer[offset + 11] = 0;
      buffer[offset + 12] = 0;

      if (isPrey) preyOffset += PREY_STRIDE; else predOffset += PRED_STRIDE;
    });

    let foodOffset = 0;
    this.food.forEach(f => {
      if (f.consumed) return;

      this._foodBuffer[foodOffset + 0] = f.position.x;
      this._foodBuffer[foodOffset + 1] = f.position.y;
      this._foodBuffer[foodOffset + 2] = f.position.z;
      this._foodBuffer[foodOffset + 3] = f.radius; // Or scale

      const numId = parseInt(f.id.split('_')[1] || '0', 10);
      this._foodBuffer[foodOffset + 4] = numId;

      foodOffset += FOOD_STRIDE;
    });

    return {
      prey: this._preyBuffer,
      preyCount: preyCount,
      predators: this._predBuffer,
      predatorCount: predCount,
      food: this._foodBuffer,
      foodCount: activeFoodCount,
    };

  }

  public importState(state: SerializedSimulationStateV1): void {
    if (state.version !== 1) {
      throw new Error(`Непідтримувана версія стану симуляції: ${String((state as any).version)}`);
    }

    this.eventBus.clearHistory();

    this.organisms.clear();
    this.food.clear();
    this.obstacles.clear();
    this.zones.clear();
    this.geneticTree.clear();
    this.geneticRoots.length = 0;
    this.spatialGrid.clear();

    this.seed = state.seed >>> 0;
    this.rng.reset(this.seed);

    this.tick = state.tick;
    this.foodIdCounter = state.counters.foodIdCounter;
    this.obstacleIdCounter = state.counters.obstacleIdCounter;

    // Оновлюємо статистику з правильними типами
    this.stats = {
      preyCount: Array.from(this.organisms.values()).filter(org => org.type === 'PREY').length,
      predatorCount: Array.from(this.organisms.values()).filter(org => org.type === 'PREDATOR').length,
      foodCount: this.food.size,
      avgEnergy: this.calculateAverageEnergy(),
      avgPreyEnergy: this.calculateAverageEnergyByType('PREY'),
      avgPredatorEnergy: this.calculateAverageEnergyByType('PREDATOR'),
      generation: this.tick,
      maxGeneration: state.stats.maxGeneration,
      maxAge: state.stats.maxAge,
      totalDeaths: state.stats.totalDeaths,
      totalBirths: state.stats.totalBirths,
      extinctionRisk: this.calculateExtinctionRisk(),
    };

    Object.assign(this.config, state.config);

    this.importCollection(state.zones, this.zones, z => ({
      id: z.id,
      type: z.type,
      center: this.mapVector3(z.center),
      radius: z.radius,
      foodMultiplier: z.foodMultiplier,
      dangerMultiplier: z.dangerMultiplier,
    }));

    this.importCollection(state.obstacles, this.obstacles, o => new Obstacle(
      createObstacleId(o.id),
      this.mapVector3(o.position),
      o.radius,
      o.color,
      o.opacity,
      o.isWireframe
    ));

    this.importCollection(state.food, this.food, f => {
      const food = new Food(
        createFoodId(f.id),
        this.mapVector3(f.position),
        f.energyValue,
        f.spawnTime
      );
      food.consumed = f.consumed;
      food.radius = f.radius;
      return food;
    });

    const tmpRng = new Random(0);
    this.importCollection(state.organisms, this.organisms, o => {
      const genome = {
        ...(o.genome as unknown as SerializedGenome),
        id: createGenomeId(o.genome.id),
        parentId: o.genome.parentId ? createGenomeId(o.genome.parentId) : null,
      };

      const organism = new Organism(
        createOrganismId(o.id),
        this.mapVector3(o.position),
        genome as any,
        o.parentOrganismId ? createOrganismId(o.parentOrganismId) : null,
        tmpRng
      );

      organism.velocity = this.mapVector3(o.velocity);
      organism.acceleration = this.mapVector3(o.acceleration);
      organism.radius = o.radius;
      organism.energy = o.energy;
      organism.age = o.age;
      organism.state = o.state;
      organism.isDead = o.isDead;
      organism.causeOfDeath = o.causeOfDeath;
      organism.trailEnabled = o.trailEnabled;
      organism.huntSuccessCount = o.huntSuccessCount;
      organism.lastActiveAt = o.lastActiveAt;

      return organism;
    });

    for (const root of state.geneticTree.roots) {
      this.geneticRoots.push(createGenomeId(root));
    }

    for (const n of state.geneticTree.nodes) {
      const node: GeneticTreeNode = {
        id: createGenomeId(n.id),
        parentId: n.parentId ? createGenomeId(n.parentId) : null,
        children: n.children.map(id => createGenomeId(id)),
        generation: n.generation,
        born: n.born,
        died: n.died,
        type: n.type,
        traits: {
          speed: n.traits.speed,
          sense: n.traits.sense,
          size: n.traits.size,
        },
      };
      this.geneticTree.set(node.id, node);
    }

    const factory = this.spawnService.getFactory();
    factory.setIdCounter(state.counters.organismIdCounter);
    factory.setGenomeIdCounter(state.counters.genomeIdCounter);

    this.reproductionSystem.setTick(this.tick);
    this.rebuildGrid();
  }

  /**
   * Реєстрація слухача подій симуляції.
   */
  public addEventListener(callback: (event: SimulationEvent) => void): () => void {
    type EventCallback = (event: SimulationEvent) => void;
    return this.eventBus.on('TickUpdated', callback as EventCallback);
  }

  /**
   * Головний ітераційний цикл оновлення стану симуляції.
   */
  public update(): void {
    // Початок вимірювання продуктивності кадру
    this.performanceMonitor.beginFrame();
    
    this.tick++;
    this.reproductionSystem.setTick(this.tick);

    // Процедурна генерація енергетичних субстратів (їжі)
    this.spawnFood();

    // Корекція просторової дискретизації
    this.rebuildGrid();

    // Циклічне застосування функціональних систем до реєстру організмів
    const endBehavior = this.performanceMonitor.startSubsystemTimer('BehaviorSystem');
    this.behaviorSystem.update(this.organisms);
    endBehavior();

    const endPhysics = this.performanceMonitor.startSubsystemTimer('PhysicsSystem');
    this.physicsSystem.update(this.organisms);
    endPhysics();

    const endMetabolism = this.performanceMonitor.startSubsystemTimer('MetabolismSystem');
    this.metabolismSystem.update(this.organisms, this.tick);
    endMetabolism();

    // Ідентифікація та аналіз механічних взаємодій (колізій)
    const endCollision = this.performanceMonitor.startSubsystemTimer('CollisionSystem');
    const deadIds = this.collisionSystem.update(this.organisms, this.food, this.obstacles);
    endCollision();

    // Верифікація можливості репродуктивних актів
    const endReproduction = this.performanceMonitor.startSubsystemTimer('ReproductionSystem');
    const newborns = this.reproductionSystem.checkReproduction(this.organisms, this.config.maxOrganisms);
    endReproduction();

    // Логування важливих подій (об'єднано для оптимізації)
    const hasSignificantEvents = deadIds.length > 0 || newborns.length > 0;
    if (hasSignificantEvents) {
      const events: string[] = [];
      const eventData: any = {};
      
      if (deadIds.length > 0) {
        events.push(`${deadIds.length} died`);
        eventData.deadCount = deadIds.length;
      }
      
      if (newborns.length > 0) {
        events.push(`${newborns.length} born`);
        eventData.newbornCount = newborns.length;
      }
      
      logger.info(`Population events: ${events.join(', ')}`, 'Engine', eventData);
    }

    // Актуалізація статистичних метрик
    this.updateStats();

    // Формування нових популяційних одиниць
    this.reproductionSystem.createOffspring(newborns, this.organisms, this.config.maxOrganisms, this.stats);

    // Елімінація об'єктів з термінальним статусом (смерть)
    this.processDeaths(deadIds);

    // Диспетчеризація оновленого стану через шину подій
    this.eventBus.emit({
      type: 'TickUpdated',
      tick: this.tick,
      stats: this.calculateStats(),
      deltaTime: 1 / 60,
    });

    // Реєстрація тика симуляції та завершення вимірювання
    this.performanceMonitor.registerTick(performance.now() - this.performanceMonitor['currentFrameStartTime']);
    this.performanceMonitor.endFrame(
      this.organisms.size + this.food.size,
      this.calculateDrawCalls()
    );
    
    // Оновлення TPS тепер відбувається автоматично в registerTick()
    // this.performanceMonitor.updateTPS(); // Вилучено - інтегровано в registerTick
  }

  // ============================================================================
  // МЕТОДИ ГЕНЕРАЦІЇ ТА УТИЛІЗАЦІЇ ОБ'ЄКТІВ
  // ============================================================================

  /**
   * Регулювання чисельності енергетичних ресурсів у середовищі.
   */
  private spawnFood(): void {
    if (this.food.size >= this.config.maxFood) return;

    if (this.rng.next() < this.config.foodSpawnRate) {
      const food = this.spawnService.spawnFood(++this.foodIdCounter);
      if (food) {
        this.food.set(food.id, food);
      }
    }
  }

  // ============================================================================
  // ДОПОМІЖНІ ОБЧИСЛЮВАЛЬНІ МЕТОДИ
  // ============================================================================

  // Кеш для дорогих обчислень
  private statsCache = {
    avgEnergy: 0,
    avgPreyEnergy: 0,
    avgPredatorEnergy: 0,
    extinctionRisk: 0,
    lastUpdate: 0,
    cacheTimeout: 1000 // 1 секунда кешу
  };

  // Кеш для даних камери
  private cameraDataCache: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
    distance: number;
    fov: number;
    aspect: number;
    near: number;
    far: number;
  } | null = null;

  /**
   * Перевірка чи потрібно оновити кеш
   */
  private shouldUpdateCache(): boolean {
    return Date.now() - this.statsCache.lastUpdate > this.statsCache.cacheTimeout;
  }

  /**
   * Актуалізація інтегральних статистичних показників популяції з оптимізацією
   */
  private updateStats(): void {
    const now = Date.now();
    const needsCacheUpdate = this.shouldUpdateCache();
    
    // Швидкі оновлення базових значень
    const preyCount = Array.from(this.organisms.values()).filter(org => org.type === 'PREY').length;
    const predatorCount = Array.from(this.organisms.values()).filter(org => org.type === 'PREDATOR').length;
    
    // Оновлюємо максимальні значення (дешева операція)
    let maxAge = this.stats.maxAge;
    let maxGeneration = this.stats.maxGeneration;
    
    this.organisms.forEach(org => {
      if (org.age > maxAge) {
        maxAge = org.age;
      }
      if (org.genome.generation > maxGeneration) {
        maxGeneration = org.genome.generation;
      }
    });

    // Оновлюємо кешовані значення тільки при потребі
    let avgEnergy = this.statsCache.avgEnergy;
    let avgPreyEnergy = this.statsCache.avgPreyEnergy;
    let avgPredatorEnergy = this.statsCache.avgPredatorEnergy;
    let extinctionRisk = this.statsCache.extinctionRisk;

    if (needsCacheUpdate) {
      avgEnergy = this.calculateAverageEnergy();
      avgPreyEnergy = this.calculateAverageEnergyByType('PREY');
      avgPredatorEnergy = this.calculateAverageEnergyByType('PREDATOR');
      extinctionRisk = this.calculateExtinctionRisk();
      
      // Оновлюємо кеш
      this.statsCache = {
        avgEnergy,
        avgPreyEnergy,
        avgPredatorEnergy,
        extinctionRisk,
        lastUpdate: now,
        cacheTimeout: 1000
      };
    }

    // Створюємо новий об'єкт статистики тільки якщо є зміни
    const newStats = {
      preyCount,
      predatorCount,
      foodCount: this.food.size,
      avgEnergy,
      avgPreyEnergy,
      avgPredatorEnergy,
      generation: this.tick,
      maxGeneration,
      maxAge,
      totalDeaths: this.stats.totalDeaths,
      totalBirths: this.stats.totalBirths,
      extinctionRisk,
    };

    // Ефективна перевірка змін ключових полів
    const hasChanges = 
      this.stats.preyCount !== preyCount ||
      this.stats.predatorCount !== predatorCount ||
      this.stats.foodCount !== this.food.size ||
      this.stats.avgEnergy !== avgEnergy ||
      this.stats.avgPreyEnergy !== avgPreyEnergy ||
      this.stats.avgPredatorEnergy !== avgPredatorEnergy ||
      this.stats.generation !== this.tick ||
      this.stats.maxGeneration !== maxGeneration ||
      this.stats.maxAge !== maxAge ||
      this.stats.extinctionRisk !== extinctionRisk;

    if (hasChanges) {
      this.stats = newStats;
    }

    // Оновлюємо геометричні дані світу (окремо, оскільки це рідка операція)
    this.updateWorldGeometry();
  }

  /**
   * Оновлення геометричних даних світу для діагностики
   */
  private updateWorldGeometry(cameraData?: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
    distance: number;
    fov: number;
    aspect: number;
    near: number;
    far: number;
  }): void {
    // Розмір світу
    (this.stats as any).worldSize = this.worldConfig.WORLD_SIZE;
    
    // Позиція камери - використовуємо дані з параметра або за замовчуванням
    if (cameraData) {
      (this.stats as any).cameraX = cameraData.position.x;
      (this.stats as any).cameraY = cameraData.position.y;
      (this.stats as any).cameraZ = cameraData.position.z;
      (this.stats as any).targetX = cameraData.target.x;
      (this.stats as any).targetY = cameraData.target.y;
      (this.stats as any).targetZ = cameraData.target.z;
      (this.stats as any).zoom = cameraData.zoom;
      (this.stats as any).cameraDistance = cameraData.distance;
      (this.stats as any).cameraFov = cameraData.fov;
      (this.stats as any).cameraAspect = cameraData.aspect;
    } else {
      (this.stats as any).cameraX = 0;
      (this.stats as any).cameraY = 0;
      (this.stats as any).cameraZ = 0;
      (this.stats as any).targetX = this.worldConfig.WORLD_SIZE / 2;
      (this.stats as any).targetY = this.worldConfig.WORLD_SIZE / 2;
      (this.stats as any).targetZ = this.worldConfig.WORLD_SIZE / 2;
      (this.stats as any).zoom = 1;
      (this.stats as any).cameraDistance = 0;
      (this.stats as any).cameraFov = 60;
      (this.stats as any).cameraAspect = 1;
    }
    
    // Екологічні зони - працюємо з Map та правильними типами
    let oasisZones = 0, desertZones = 0, huntingGrounds = 0, sanctuaries = 0;
    this.zones.forEach(zone => {
      switch (zone.type) {
        case 'OASIS': oasisZones++; break;
        case 'DESERT': desertZones++; break;
        case 'HUNTING_GROUND': huntingGrounds++; break;
        case 'SANCTUARY': sanctuaries++; break;
      }
      // Поле 'active' не існує, рахуємо всі зони як активні
    });
    
    (this.stats as any).growthZones = oasisZones; // OASIS = зони росту
    (this.stats as any).neutralZones = desertZones; // DESERT = нейтральні
    (this.stats as any).dangerZones = huntingGrounds; // HUNTING_GROUND = небезпечні
    (this.stats as any).totalZones = this.zones.size;
    (this.stats as any).activeZones = this.zones.size; // Всі зони вважаються активними
    
    // Просторова сітка - використовуємо публічні методи
    const gridSize = this.getCellSizeFromGrid();
    (this.stats as any).cellSize = gridSize;
    const dimensions = this.getDimensionsFromGrid();
    (this.stats as any).totalCells = dimensions ** 3; // 3D сітка
    (this.stats as any).occupiedCells = this.calculateOccupiedCells();
    
    // Розрахунок щільності
    const totalPossibleCells = (this.stats as any).totalCells;
    const occupied = (this.stats as any).occupiedCells;
    (this.stats as any).avgDensity = totalPossibleCells > 0 ? (occupied / totalPossibleCells * 100) : 0;
    (this.stats as any).maxDensity = this.calculateMaxCellDensity();
    (this.stats as any).gridEfficiency = this.calculateGridEfficiency();
    
    // Інші параметри світу
    (this.stats as any).foodSpawnRate = this.config.foodSpawnRate || 5;
    (this.stats as any).obstacleCount = this.obstacles.size;
    (this.stats as any).worldAge = Math.floor(this.tick / 60); // Припускаємо 60 TPS
  }

  /**
   * Отримання розміру комірки з сітки
   */
  private getCellSizeFromGrid(): number {
    // Імпортуємо константу або використовуємо значення за замовчуванням
    return 80; // CELL_SIZE з constants.ts
  }

  /**
   * Отримання розмірів сітки
   */
  private getDimensionsFromGrid(): number {
    return Math.ceil(this.worldConfig.WORLD_SIZE / this.getCellSizeFromGrid());
  }

  /**
   * Розрахунок кількості зайнятих комірок
   */
  private calculateOccupiedCells(): number {
    const occupiedCells = new Set();
    const cellSize = this.getCellSizeFromGrid();
    const worldSize = this.worldConfig.WORLD_SIZE;
    
    // Додаємо комірки організмів
    this.organisms.forEach(org => {
      const gx = Math.floor(((org.position.x % worldSize) + worldSize) % worldSize / cellSize);
      const gy = Math.floor(((org.position.y % worldSize) + worldSize) % worldSize / cellSize);
      const gz = Math.floor(((org.position.z % worldSize) + worldSize) % worldSize / cellSize);
      const dimensions = this.getDimensionsFromGrid();
      const key = gx + gy * dimensions + gz * dimensions * dimensions;
      occupiedCells.add(key);
    });
    
    // Додаємо комірки їжі
    this.food.forEach(food => {
      const gx = Math.floor(((food.position.x % worldSize) + worldSize) % worldSize / cellSize);
      const gy = Math.floor(((food.position.y % worldSize) + worldSize) % worldSize / cellSize);
      const gz = Math.floor(((food.position.z % worldSize) + worldSize) % worldSize / cellSize);
      const dimensions = this.getDimensionsFromGrid();
      const key = gx + gy * dimensions + gz * dimensions * dimensions;
      occupiedCells.add(key);
    });
    
    return occupiedCells.size;
  }

  /**
   * Розрахунок максимальної щільності комірки
   */
  private calculateMaxCellDensity(): number {
    const cellCounts = new Map();
    const cellSize = this.getCellSizeFromGrid();
    const worldSize = this.worldConfig.WORLD_SIZE;
    
    // Рахуємо організми по комірках
    this.organisms.forEach(org => {
      const gx = Math.floor(((org.position.x % worldSize) + worldSize) % worldSize / cellSize);
      const gy = Math.floor(((org.position.y % worldSize) + worldSize) % worldSize / cellSize);
      const gz = Math.floor(((org.position.z % worldSize) + worldSize) % worldSize / cellSize);
      const dimensions = this.getDimensionsFromGrid();
      const key = gx + gy * dimensions + gz * dimensions * dimensions;
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });
    
    // Рахуємо їжу по комірках
    this.food.forEach(food => {
      const gx = Math.floor(((food.position.x % worldSize) + worldSize) % worldSize / cellSize);
      const gy = Math.floor(((food.position.y % worldSize) + worldSize) % worldSize / cellSize);
      const gz = Math.floor(((food.position.z % worldSize) + worldSize) % worldSize / cellSize);
      const dimensions = this.getDimensionsFromGrid();
      const key = gx + gy * dimensions + gz * dimensions * dimensions;
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });
    
    // Знаходимо максимальну щільність
    let maxCount = 0;
    cellCounts.forEach(count => {
      if (count > maxCount) maxCount = count;
    });
    
    return maxCount;
  }

  /**
   * Розрахунок ефективності просторової сітки
   */
  private calculateGridEfficiency(): number {
    const totalEntities = this.organisms.size + this.food.size;
    const occupiedCells = this.calculateOccupiedCells();
    
    if (totalEntities === 0 || occupiedCells === 0) return 100;
    
    // Ідеальна ситуація: кожна сутність в окремій комірці
    const idealCells = totalEntities;
    const efficiency = Math.min(100, (idealCells / occupiedCells) * 100);
    
    return Math.round(efficiency);
  }

  /**
   * Розрахунок середньої енергії всіх організмів
   */
  private calculateAverageEnergy(): number {
    if (this.organisms.size === 0) return 0;
    
    let totalEnergy = 0;
    this.organisms.forEach(org => {
      totalEnergy += org.energy;
    });
    
    return totalEnergy / this.organisms.size;
  }

  /**
   * Розрахунок середньої енергії за типом
   */
  private calculateAverageEnergyByType(type: 'PREY' | 'PREDATOR'): number {
    const organisms = Array.from(this.organisms.values()).filter(org => org.type === type);
    if (organisms.length === 0) return 0;
    
    let totalEnergy = 0;
    organisms.forEach(org => {
      totalEnergy += org.energy;
    });
    
    return totalEnergy / organisms.length;
  }

  /**
   * Розрахунок ризику вимирання
   */
  private calculateExtinctionRisk(): number {
    const totalOrganisms = this.organisms.size;
    const preyCount = Array.from(this.organisms.values()).filter(org => org.type === 'PREY').length;
    const predatorCount = Array.from(this.organisms.values()).filter(org => org.type === 'PREDATOR').length;
    
    // Якщо немає організмів - ризик 100%
    if (totalOrganisms === 0) return 1;
    
    // Якщо немає травоїдних - високий ризик
    if (preyCount === 0) return 0.8;
    
    // Якщо немає хижаків - низький ризик
    if (predatorCount === 0) return 0.1;
    
    // Розрахунок співвідношення хижаків до травоїдних
    const predatorRatio = predatorCount / preyCount;
    
    // Ідеальне співвідношення 1:10
    const idealRatio = 0.1;
    const ratioDeviation = Math.abs(predatorRatio - idealRatio) / idealRatio;
    
    // Чим більше відхилення, тим вищий ризик
    return Math.min(0.9, ratioDeviation * 0.5);
  }

  /**
   * Встановлення даних камери для діагностики
   */
  public setCameraData(cameraData: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
    distance: number;
    fov: number;
    aspect: number;
    near: number;
    far: number;
  }): void {
    // Зберігаємо дані камери в кеш
    this.cameraDataCache = { ...cameraData };
    
    // Оновлюємо геометричні дані світу з даними камери
    this.updateWorldGeometry(cameraData);
  }

  /**
   * Адміністрування процесу видалення суб'єктів та фіксація причин елімінації.
   */
  private processDeaths(deadIds: string[]): void {
    let newDeaths = 0;
    
    for (const id of deadIds) {
      const org = this.organisms.get(id);
      if (org) {
        newDeaths++;

        // Модифікація філогенетичної структури при видаленні агента
        this.reproductionSystem.updateGeneticTreeOnDeath(org);

        this.eventBus.emit({
          type: 'EntityDied',
          entityType: org.type,
          id: id as EntityId,
          position: org.position,
          causeOfDeath: 'old_age'
        });
      }
    }

    // Оновлюємо статистику створюючи новий об'єкт
    if (newDeaths > 0) {
      this.stats = {
        ...this.stats,
        totalDeaths: this.stats.totalDeaths + newDeaths,
      };
    }
  }

  /**
   * Отримання поточної статистики симуляції
   */
  public getStats(): SimulationStats {
    return { ...this.stats };
  }

  /**
   * Отримання поточної статистики з геометричними даними
   */
  public getStatsWithWorldData(): SimulationStats {
    // Оновлюємо геометричні дані перед поверненням, використовуючи кешовані дані камери
    this.updateWorldGeometry(this.cameraDataCache);
    return { ...this.stats };
  }

  /**
   * Перебудова просторової сітки
   */
  private rebuildGrid(): void {
    this.spatialGrid.clear();

    const insertEntity = (e: import('../types').GridEntity) => {
      this.spatialGrid.insert({
        id: e.id,
        position: e.position,
        type: e.type,
        radius: e.radius,
      });
    };

    this.organisms.forEach(o => {
      if (!o.isDead) insertEntity(o);
    });

    this.food.forEach(f => {
      if (!f.consumed) insertEntity(f);
    });

    if (this.config.showObstacles) {
      this.obstacles.forEach(insertEntity);
    }
  }

  /**
   * Комплексний розрахунок та агрегація поточної статистики симуляції.
   */
  private calculateStats(): SimulationStats {
    let prey = 0;
    let pred = 0;
    let preyEnergySum = 0;
    let predEnergySum = 0;

    this.organisms.forEach(o => {
      if (o.isDead) return;
      if (o.isPrey) {
        prey++;
        preyEnergySum += o.energy;
      } else {
        pred++;
        predEnergySum += o.energy;
      }
    });

    const totalEnergy = preyEnergySum + predEnergySum;
    const totalCount = prey + pred;

    const minViablePopulation = 5;
    const preyRisk = prey < minViablePopulation ? 1 - prey / minViablePopulation : 0;
    const predRisk = pred < minViablePopulation ? 1 - pred / minViablePopulation : 0;
    const extinctionRisk = Math.max(preyRisk, predRisk);

    return {
      preyCount: prey,
      predatorCount: pred,
      foodCount: this.food.size,
      avgEnergy: totalCount > 0 ? totalEnergy / totalCount : 0,
      avgPreyEnergy: prey > 0 ? preyEnergySum / prey : 0,
      avgPredatorEnergy: pred > 0 ? predEnergySum / pred : 0,
      generation: this.stats.maxGeneration,
      maxGeneration: this.stats.maxGeneration,
      maxAge: this.stats.maxAge,
      totalDeaths: this.stats.totalDeaths,
      totalBirths: this.stats.totalBirths,
      extinctionRisk,
      performance: this.performanceMonitor.getCurrentMetrics()
    };
  }

  /**
   * Розрахунок кількості викликів відмальовування (приблизний).
   */
  private calculateDrawCalls(): number {
    let drawCalls = 0;
    
    // Organisms (prey + predators)
    drawCalls += this.organisms.size;
    
    // Food items
    drawCalls += this.food.size;
    
    // Obstacles (if visible)
    if (this.config.showObstacles) {
      drawCalls += this.obstacles.size;
    }
    
    // Zones (visual effects)
    drawCalls += this.zones.size;
    
    return drawCalls;
  }

  /**
   * Отримання доступу до монітора продуктивності.
   */
  public getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Отримання поточного значення ітераційного лічильника.
   */
  public getTick(): number {
    return this.tick;
  }

  /**
   * Отримання інформаційної структури генетичного дерева для потреб візуалізації.
   */
  public getGeneticTree() {
    return this.reproductionSystem.getGeneticTreeInfo();
  }
  /**
   * Універсальний імпортер колекцій сутностей.
   */
  private importCollection<TData, TEntity extends { id: string }>(
    data: TData[],
    dest: Map<string, TEntity>,
    factory: (d: TData) => TEntity
  ): void {
    dest.clear();
    for (const item of data) {
      const entity = factory(item);
      dest.set(entity.id, entity);
    }
  }

  /**
   * Перевірка та збільшення ємності буфера за необхідності.
   * @deprecated Використовуйте ensureBufferCapacityAdaptive для кращої ефективності пам'яті.
   */
  private ensureBufferCapacity(buffer: Float32Array, requiredSize: number): Float32Array {
    if (buffer.length < requiredSize) {
      return new Float32Array(requiredSize * 1.5);
    }
    return buffer;
  }

  /**
   * Адаптивне управління ємністю буфера з підтримкою динамічного скорочення.
   *
   * Стратегія:
   * - При зростанні популяції: алокація з 50% запасом (growth factor 1.5).
   * - При значному зменшенні (>75%): скорочення до нового розміру + 25% запасу.
   * - При незначних коливаннях: збереження існуючої ємності (мінімізація реалокацій).
   *
   * @param buffer Поточний буфер.
   * @param requiredSize Необхідний розмір у елементах.
   * @param previousSize Попередній використаний розмір для детектування тренду.
   * @returns Оптимізований буфер.
   */
  private ensureBufferCapacityAdaptive(
    buffer: Float32Array,
    requiredSize: number,
    previousSize: number
  ): Float32Array {
    const currentCapacity = buffer.length;

    // Сценарій 1: Необхідне збільшення ємності
    if (requiredSize > currentCapacity) {
      return new Float32Array(Math.ceil(requiredSize * 1.5));
    }

    // Сценарій 2: Детектування значного зменшення популяції (гістерезис)
    const utilizationRatio = requiredSize / currentCapacity;
    if (utilizationRatio < SimulationEngine.SHRINK_THRESHOLD && currentCapacity > 100) {
      // Скорочення буфера з невеликим запасом для запобігання частим реалокаціям
      return new Float32Array(Math.ceil(requiredSize * 1.25));
    }

    // Сценарій 3: Стабільний стан — повторне використання існуючого буфера
    return buffer;
  }

  /**
   * Допоміжний метод для серіалізації векторів.
   */
  private mapVector3(v: { x: number; y: number; z: number }): import('../types').MutableVector3 {
    return { x: v.x, y: v.y, z: v.z };
  }
}
