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
import { EventBus } from '../core/EventBus';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { MetabolismSystem } from './systems/MetabolismSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { BehaviorSystem } from './systems/BehaviorSystem';
import { ReproductionSystem } from './systems/ReproductionSystem';
import { SpawnService } from './services/SpawnService';
import { Random } from '../core/utils/Random';

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

  // Системні лічильники та часова дискретизація
  private foodIdCounter: number = 0;
  private obstacleIdCounter: number = 0;
  private tick: number = 0;

  private readonly rng: Random;
  private seed: number;

  // Метрики статистичного аналізу
  private stats = {
    totalDeaths: 0,
    totalBirths: 0,
    maxAge: 0,
    maxGeneration: 1,
  };

  // Реєстр конфігураційних параметрів
  public config: SimulationConfig;
  public worldConfig: WorldConfig;

  constructor(scale: number = 1.0) {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = new Random(this.seed);
    this.worldConfig = createWorldConfig(scale);
    this.config = this.createDefaultConfig();

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
      totalDeaths: 0,
      totalBirths: 0,
      maxAge: 0,
      maxGeneration: 1,
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
    this.rng.setState(state.rngState);

    this.tick = state.tick;
    this.foodIdCounter = state.counters.foodIdCounter;
    this.obstacleIdCounter = state.counters.obstacleIdCounter;
    this.stats = {
      totalDeaths: state.stats.totalDeaths,
      totalBirths: state.stats.totalBirths,
      maxAge: state.stats.maxAge,
      maxGeneration: state.stats.maxGeneration,
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
    this.tick++;
    this.reproductionSystem.setTick(this.tick);

    // Процедурна генерація енергетичних субстратів (їжі)
    this.spawnFood();

    // Корекція просторової дискретизації
    this.rebuildGrid();

    // Циклічне застосування функціональних систем до реєстру організмів
    this.behaviorSystem.update(this.organisms);
    this.physicsSystem.update(this.organisms);
    this.metabolismSystem.update(this.organisms, this.tick);

    // Ідентифікація та аналіз механічних взаємодій (колізій)
    const deadIds = this.collisionSystem.update(this.organisms, this.food, this.obstacles);

    // Верифікація можливості репродуктивних актів
    const newborns = this.reproductionSystem.checkReproduction(this.organisms, this.config.maxOrganisms);

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

  /**
   * Актуалізація інтегральних статистичних показників популяції.
   */
  private updateStats(): void {
    this.organisms.forEach(org => {
      if (org.age > this.stats.maxAge) {
        this.stats.maxAge = org.age;
      }
      if (org.genome.generation > this.stats.maxGeneration) {
        this.stats.maxGeneration = org.genome.generation;
      }
    });
  }

  /**
   * Адміністрування процесу видалення суб'єктів та фіксація причин елімінації.
   */
  private processDeaths(deadIds: string[]): void {
    for (const id of deadIds) {
      const org = this.organisms.get(id);
      if (org) {
        this.stats.totalDeaths++;

        // Модифікація філогенетичної структури при видаленні агента
        this.reproductionSystem.updateGeneticTreeOnDeath(org);

        this.eventBus.emit({
          type: 'EntityDied',
          entityType: org.type,
          id: org.id as OrganismId,
          position: { ...org.position },
          causeOfDeath: org.causeOfDeath || 'starvation',
        });

        this.organisms.delete(id);
      }
    }
  }

  /**
   * Перебудова структури просторового хешування для оптимізації пошукових запитів.
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
    };
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
