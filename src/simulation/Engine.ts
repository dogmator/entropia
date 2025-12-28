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

import { SpawnService } from '@simulation/services';
import { BehaviorSystem } from '@simulation/systems';
import { CollisionSystem } from '@simulation/systems';
import { MetabolismSystem } from '@simulation/systems';
import { PhysicsSystem } from '@simulation/systems';
import { ReproductionSystem } from '@simulation/systems';

import { EventBus } from '@/core';
import { logger } from '@/core';
import { PerformanceMonitor } from '@/core';
import { Random } from '@/core';
import type {
  EcologicalZone,
  EntityId,
  GeneticTreeNode,
  GenomeId,
  SerializedSimulationStateV1,
  SimulationConfig,
  SimulationEvent,
  SimulationStats,
  WorldConfig
} from '@/types';
import {
  EntityType,
  ZoneType,
} from '@/types';

import {
  createWorldConfig,
  ENGINE_CONSTANTS,
  GENETICS,
  INITIAL_VIS_CONFIG,
  PHYSICS,
  REPRODUCTION_ENERGY_THRESHOLD,
  ZONE_DEFAULTS,
} from '../config';
import { Food, Obstacle, Organism } from './Entity';
import { EntityManager, GridManager } from './managers';
import { CameraDataProvider } from './providers';
import { BufferManager } from './services/BufferManager';
import { PersistenceService } from './services/PersistenceService';
import { StatisticsManager } from './services/StatisticsManager';
import { SpatialHashGrid } from './SpatialHashGrid';

// ENGINE_CONSTANTS тепер імпортується з constants.ts

export class SimulationEngine {
  // Менеджер управління сутностями
  private readonly entityManager: EntityManager;
  private readonly gridManager: GridManager;
  private readonly cameraDataProvider: CameraDataProvider;

  // Дескриптори колекцій віртуальних сутностей (геттери для обратної совместимости)
  public get organisms(): Map<string, Organism> { return this.entityManager.organisms; }
  public get food(): Map<string, Food> { return this.entityManager.food; }
  public get obstacles(): Map<string, Obstacle> { return this.entityManager.obstacles; }

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
  private readonly bufferManager: BufferManager;
  private readonly statisticsManager: StatisticsManager;

  // Системні лічильники та часова дискретизація
  private foodIdCounter: number = 0;
  private obstacleIdCounter: number = 0;
  private tick: number = 0;

  private readonly rng: Random;
  private seed: number;

  // Реєстр конфігураційних параметрів
  public config: SimulationConfig;
  public worldConfig: WorldConfig;

  constructor(scale: number = 1.0) {
    this.seed = (Math.random() * ENGINE_CONSTANTS.SEED_LIMIT) >>> 0; // eslint-disable-line sonarjs/pseudo-random
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

    // Ініціалізація менеджерів
    this.entityManager = new EntityManager(this.spatialGrid);
    this.gridManager = new GridManager(this.spatialGrid);
    this.cameraDataProvider = new CameraDataProvider();

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

    // Ініціалізація монітора продуктивності та менеджера буферів
    this.performanceMonitor = new PerformanceMonitor();
    this.bufferManager = new BufferManager(true);
    this.statisticsManager = new StatisticsManager(this.worldConfig);
    logger.info('PerformanceMonitor, BufferManager, and StatisticsManager initialized', 'Engine');

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
    const centerMult = ENGINE_CONSTANTS.ZONE_CENTER_MULT;

    this.zones.set('oasis_center', {
      id: 'oasis_center',
      type: ZoneType.OASIS,
      center: { x: ws * centerMult, y: ws * centerMult, z: ws * centerMult },
      radius: ws * ENGINE_CONSTANTS.ZONE_OASIS_RADIUS_MULT,
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
        radius: ws * ENGINE_CONSTANTS.ZONE_DESERT_RADIUS_MULT,
        foodMultiplier: ZONE_DEFAULTS.DESERT.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.DESERT.dangerMultiplier,
      });
    });

    this.zones.set('hunting_ground', {
      id: 'hunting_ground',
      type: ZoneType.HUNTING_GROUND,
      center: { x: ws * ENGINE_CONSTANTS.ZONE_HUNTING_X_MULT, y: ws * centerMult, z: ws * ENGINE_CONSTANTS.ZONE_HUNTING_Z_MULT },
      radius: ws * ENGINE_CONSTANTS.ZONE_HUNTING_RADIUS_MULT,
      foodMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.dangerMultiplier,
    });

    this.zones.set('sanctuary', {
      id: 'sanctuary',
      type: ZoneType.SANCTUARY,
      center: { x: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_X_MULT, y: ws * centerMult, z: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_Z_MULT },
      radius: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_RADIUS_MULT,
      foodMultiplier: ZONE_DEFAULTS.SANCTUARY.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.SANCTUARY.dangerMultiplier,
    });
  }

  /**
   * Створення статичних геометричних перешкод у просторі.
   */
  private createObstacles(): void {
    const count = ENGINE_CONSTANTS.OBSTACLE_COUNT;
    for (let i = 0; i < count; i++) {
      const radius = ENGINE_CONSTANTS.OBSTACLE_MIN_RADIUS + this.rng.next() * ENGINE_CONSTANTS.OBSTACLE_RADIUS_RANGE;
      const obstacle = Obstacle.create(
        ++this.obstacleIdCounter,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        this.rng.next() * this.worldConfig.WORLD_SIZE,
        radius,
        this.rng
      );
      this.entityManager.addObstacle(obstacle);
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
        this.entityManager.addOrganism(organism);
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
    this.entityManager.clear();
    this.zones.clear();
    this.geneticTree.clear();
    this.geneticRoots.length = 0;
    this.gridManager.clear();

    this.foodIdCounter = 0;
    this.obstacleIdCounter = 0;
    this.tick = 0;
    this.statisticsManager.reset();

    this.spawnService.resetFactory();
    this.bufferManager.reset();
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

  /**
   * Конвертує Vector3 об'єкт для серіалізації.
   */
  public mapVector3(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
      x: vector.x,
      y: vector.y,
      z: vector.z
    };
  }

  public exportState(): SerializedSimulationStateV1 {
    return PersistenceService.exportState(this);
  }

  // ============================================================================
  // ЕКСПОРТ ДАНИХ ДЛЯ РЕНДЕРИНГУ / WEB WORKERS
  // ============================================================================

  // Внутрішні буфери тепер управляються BufferManager

  public getRenderData(): import('../types').RenderBuffers {
    return this.bufferManager.getRenderData(this.organisms, this.food);
  }

  // Методи для рендерингу тепер виконуються через BufferManager

  public importState(state: SerializedSimulationStateV1): void {
    PersistenceService.importState(this, state);
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
    this.gridManager.rebuild(
      this.entityManager.organisms,
      this.entityManager.food,
      this.entityManager.obstacles,
      this.config.showObstacles
    );

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
      const eventData: import('@/types').EngineEventData = {};

      if (deadIds.length > 0) {
        events.push(`${deadIds.length} died`);
        eventData.deadCount = deadIds.length;
      }

      if (newborns.length > 0) {
        events.push(`${newborns.length} born`);
        eventData.newbornCount = newborns.length;
      }

      logger.info(`Population events: ${events.join(', ')}`, 'Engine', eventData as Record<string, unknown>);
    }

    // Актуалізація статистичних метрик
    this.statisticsManager.update(
      this.entityManager.organisms,
      this.entityManager.food.size,
      this.entityManager.obstacles.size,
      this.tick,
      this.zones,
      this.spatialGrid,
      this.config
    );

    // Формування нових популяційних одиниць
    this.reproductionSystem.createOffspring(newborns, this.organisms, this.config.maxOrganisms, this.statisticsManager.getStats());

    // Елімінація об'єктів з термінальним статусом (смерть)
    this.processDeaths(deadIds);

    // Диспетчеризація оновленого стану через шину подій
    this.eventBus.emit({
      type: 'TickUpdated',
      tick: this.tick,
      stats: this.statisticsManager.getStats(),
      deltaTime: 1 / ENGINE_CONSTANTS.TICK_RATE,
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
    if (this.food.size >= this.config.maxFood) { return; }

    if (this.rng.next() < this.config.foodSpawnRate) {
      const food = this.spawnService.spawnFood(++this.foodIdCounter);
      if (food) {
        this.entityManager.addFood(food);
      }
    }
  }

  // ============================================================================
  // УПРАВЛІННЯ ДАНИМИ КАМЕРИ ТА СТАТИСТИКОЮ
  // ============================================================================

  /**
   * Встановлення даних камери для діагностики
   */
  public setCameraData(cameraData: import('@/types').CameraData): void {
    // Зберігаємо дані камери через провайдер
    this.cameraDataProvider.setCameraData(cameraData);

    // Оновлюємо дані камери в статистиці
    this.statisticsManager.setCameraData(cameraData);
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

    // Оновлюємо статистику
    if (newDeaths > 0) {
      this.statisticsManager.incrementDeaths(newDeaths);
    }
  }

  /**
   * Отримання поточної статистики симуляції
   */
  public getStats(): SimulationStats {
    return this.statisticsManager.getStats();
  }

  /**
   * Отримання поточної статистики з геометричними даними
   */
  public getStatsWithWorldData(): SimulationStats {
    // Геометричні дані оновлюються автоматично в statisticsManager.update()
    return this.statisticsManager.getStats();
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



  // Адаптивне управління тепер винесено до BufferManager


  /**
   * Пошук організму за заданими координатами з урахуванням допуску.
   * Використовується для інтерактивності (тултипи, селекція).
   */
  public findEntityAt(pos: { x: number; y: number; z: number }, tolerance: number): Organism | null {
    return this.entityManager.findEntityAt(pos, tolerance);
  }

  /**
   * Пошук їжі за заданими координатами.
   */
  public findFoodAt(pos: { x: number; y: number; z: number }, tolerance: number): Food | null {
    return this.entityManager.findFoodAt(pos, tolerance);
  }

  /**
   * Пошук сутності за індексом рендерингу (Instance ID).
   */
  public getEntityByInstanceId(type: 'prey' | 'predator' | 'food', index: number): Organism | Food | null {
    return this.entityManager.getEntityByInstanceId(type, index);
  }
}
