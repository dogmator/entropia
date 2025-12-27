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
} from '../constants';
import { Food, Obstacle, Organism } from './Entity';
import { BufferManager } from './services/BufferManager';
import { PersistenceService } from './services/PersistenceService';
import { SpatialHashGrid } from './SpatialHashGrid';

// ENGINE_CONSTANTS тепер імпортується з constants.ts

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
  private readonly bufferManager: BufferManager;

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

    // Ініціалізація монітора продуктивності та менеджера буферів
    this.performanceMonitor = new PerformanceMonitor();
    this.bufferManager = new BufferManager(true);
    logger.info('PerformanceMonitor and BufferManager initialized', 'Engine');

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
      generation: ENGINE_CONSTANTS.INITIAL_GENERATION,
      maxGeneration: ENGINE_CONSTANTS.INITIAL_MAX_GENERATION,
      maxAge: ENGINE_CONSTANTS.INITIAL_STAT_VALUE,
      totalDeaths: ENGINE_CONSTANTS.INITIAL_STAT_VALUE,
      totalBirths: ENGINE_CONSTANTS.INITIAL_STAT_VALUE,
      extinctionRisk: 0,
    };

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
      stats: this.stats,
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
    const baseStats = this.calculateBasicPopStats();
    const maxStats = this.calculateMaxStats();
    const cachedStats = this.getOrUpdateCachedStats();

    const newStats = {
      ...baseStats,
      ...maxStats,
      ...cachedStats,
      generation: this.tick,
      totalDeaths: this.stats.totalDeaths,
      totalBirths: this.stats.totalBirths,
    };

    if (this.hasStatsChanged(newStats)) {
      this.stats = newStats;
    }

    this.updateWorldGeometry();
  }

  private calculateBasicPopStats(): Pick<SimulationStats, 'preyCount' | 'predatorCount' | 'foodCount'> {
    let preyCount = 0;
    let predatorCount = 0;

    this.organisms.forEach(org => {
      if (org.type === 'PREY') {
        preyCount++;
      } else {
        predatorCount++;
      }
    });

    return {
      preyCount,
      predatorCount,
      foodCount: this.food.size,
    };
  }

  private calculateMaxStats(): Pick<SimulationStats, 'maxAge' | 'maxGeneration'> {
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

    return { maxAge, maxGeneration };
  }

  private getOrUpdateCachedStats(): Pick<SimulationStats, 'avgEnergy' | 'avgPreyEnergy' | 'avgPredatorEnergy' | 'extinctionRisk'> {
    if (!this.shouldUpdateCache()) {
      return {
        avgEnergy: this.statsCache.avgEnergy,
        avgPreyEnergy: this.statsCache.avgPreyEnergy,
        avgPredatorEnergy: this.statsCache.avgPredatorEnergy,
        extinctionRisk: this.statsCache.extinctionRisk,
      };
    }

    const avgEnergy = this.calculateAverageEnergy();
    const avgPreyEnergy = this.calculateAverageEnergyByType(EntityType.PREY);
    const avgPredatorEnergy = this.calculateAverageEnergyByType(EntityType.PREDATOR);
    const extinctionRisk = this.calculateExtinctionRisk();

    this.statsCache = {
      avgEnergy,
      avgPreyEnergy,
      avgPredatorEnergy,
      extinctionRisk,
      lastUpdate: Date.now(),
      cacheTimeout: ENGINE_CONSTANTS.MS_PER_SECOND
    };

    return { avgEnergy, avgPreyEnergy, avgPredatorEnergy, extinctionRisk };
  }

  private hasStatsChanged(newStats: SimulationStats): boolean {
    return (
      this.stats.preyCount !== newStats.preyCount ||
      this.stats.predatorCount !== newStats.predatorCount ||
      this.stats.foodCount !== newStats.foodCount ||
      this.stats.avgEnergy !== newStats.avgEnergy ||
      this.stats.extinctionRisk !== newStats.extinctionRisk ||
      this.stats.generation !== newStats.generation ||
      this.stats.maxAge !== newStats.maxAge
    );
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
    (this.stats as any).worldSize = this.worldConfig.WORLD_SIZE;
    this.updateCameraStats(cameraData);
    this.updateZoneStats();
    this.updateGridStats();
    (this.stats as any).foodSpawnRate = this.config.foodSpawnRate || 0;
    (this.stats as any).obstacleCount = this.obstacles.size;
    (this.stats as any).worldAge = Math.floor(this.tick / ENGINE_CONSTANTS.WORLD_AGE_FALLBACK_TPS);
  }

  private updateCameraStats(cameraData?: any): void {
    if (cameraData) {
      this.stats = {
        ...this.stats,
        cameraX: cameraData.position.x,
        cameraY: cameraData.position.y,
        cameraZ: cameraData.position.z,
        targetX: cameraData.target.x,
        targetY: cameraData.target.y,
        targetZ: cameraData.target.z,
        zoom: cameraData.zoom,
        cameraDistance: cameraData.distance,
        cameraFov: cameraData.fov,
        cameraAspect: cameraData.aspect,
      };
    } else {
      this.resetCameraStats();
    }
  }

  private resetCameraStats(): void {
    this.stats = {
      ...this.stats,
      cameraX: 0,
      cameraY: 0,
      cameraZ: 0,
      targetX: this.worldConfig.WORLD_SIZE / 2,
      targetY: this.worldConfig.WORLD_SIZE / 2,
      targetZ: this.worldConfig.WORLD_SIZE / 2,
      zoom: ENGINE_CONSTANTS.DEFAULT_ZOOM,
      cameraDistance: 0,
      cameraFov: ENGINE_CONSTANTS.DEFAULT_CAMERA_FOV,
      cameraAspect: 1,
    };
  }

  private updateZoneStats(): void {
    let oasis = 0;
    let desert = 0;
    let hunting = 0;
    let sanctuary = 0;

    this.zones.forEach(z => {
      if (z.type === 'OASIS') { oasis++; }
      else if (z.type === 'DESERT') { desert++; }
      else if (z.type === 'HUNTING_GROUND') { hunting++; }
      else if (z.type === 'SANCTUARY') { sanctuary++; }
    });

    this.stats = {
      ...this.stats,
      growthZones: oasis,
      neutralZones: desert,
      dangerZones: hunting,
      totalZones: this.zones.size,
      activeZones: this.zones.size,
    };
  }

  private updateGridStats(): void {
    const cellSize = this.getCellSizeFromGrid();
    const dimensions = this.getDimensionsFromGrid();
    const occupied = this.calculateOccupiedCells();
    const totalCells = dimensions ** 3;

    this.stats = {
      ...this.stats,
      cellSize: cellSize,
      totalCells: totalCells,
      occupiedCells: occupied,
      avgDensity: totalCells > 0 ? (occupied / totalCells * 100) : 0,
      maxDensity: this.calculateMaxCellDensity(),
      gridEfficiency: this.calculateGridEfficiency(),
    };
  }

  /**
   * Отримання розміру комірки з сітки
   */
  private getCellSizeFromGrid(): number {
    return ENGINE_CONSTANTS.MAX_CELL_SIZE;
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
    const occupiedCells = new Set<number>();

    this.organisms.forEach(org => {
      occupiedCells.add(this.getGridKey(org.position));
    });

    this.food.forEach(food => {
      occupiedCells.add(this.getGridKey(food.position));
    });

    return occupiedCells.size;
  }

  private getGridKey(pos: { x: number; y: number; z: number }): number {
    const worldSize = this.worldConfig.WORLD_SIZE;
    const cellSize = this.getCellSizeFromGrid();
    const dimensions = this.getDimensionsFromGrid();

    const gx = Math.floor(((pos.x % worldSize) + worldSize) % worldSize / cellSize);
    const gy = Math.floor(((pos.y % worldSize) + worldSize) % worldSize / cellSize);
    const gz = Math.floor(((pos.z % worldSize) + worldSize) % worldSize / cellSize);
    return gx + gy * dimensions + gz * dimensions * dimensions;
  }

  /**
   * Розрахунок максимальної щільності комірки
   */
  private calculateMaxCellDensity(): number {
    const cellCounts = new Map<number, number>();
    //const worldSize = this.worldConfig.WORLD_SIZE;
    //const cellSize = this.getCellSizeFromGrid();
    //const dimensions = this.getDimensionsFromGrid();

    this.organisms.forEach(org => {
      const key = this.getGridKey(org.position);
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });

    this.food.forEach(food => {
      const key = this.getGridKey(food.position);
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });

    let maxCount = 0;
    cellCounts.forEach(count => {
      if (count > maxCount) { maxCount = count; }
    });

    return maxCount;
  }

  /**
   * Розрахунок ефективності просторової сітки
   */
  private calculateGridEfficiency(): number {
    const totalEntities = this.organisms.size + this.food.size;
    const occupiedCells = this.calculateOccupiedCells();

    const FULL_PERCENT = 100;
    if (totalEntities === 0 || occupiedCells === 0) { return FULL_PERCENT; }

    // Ідеальна ситуація: кожна сутність в окремій комірці
    const idealCells = totalEntities;
    const efficiency = Math.min(FULL_PERCENT, (idealCells / occupiedCells) * FULL_PERCENT);

    return Math.round(efficiency);
  }

  /**
   * Розрахунок середньої енергії всіх організмів
   */
  private calculateAverageEnergy(): number {
    if (this.organisms.size === 0) { return 0; }

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
    if (organisms.length === 0) { return 0; }

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
    if (totalOrganisms === 0) { return 1; }

    // Якщо немає травоїдних - високий ризик
    if (preyCount === 0) { return 0.8; }

    // Якщо немає хижаків - низький ризик
    if (predatorCount === 0) { return 0.1; }

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
    this.updateWorldGeometry(this.cameraDataCache ?? undefined);
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
      if (!o.isDead) { insertEntity(o); }
    });

    this.food.forEach(f => {
      if (!f.consumed) { insertEntity(f); }
    });

    if (this.config.showObstacles) {
      this.obstacles.forEach(insertEntity);
    }
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
    const candidates = this.getEntityCandidates(pos, tolerance);
    return this.findClosestOrganism(candidates, pos, tolerance);
  }

  private getEntityCandidates(pos: { x: number; y: number; z: number }, tolerance: number): string[] {
    try {
      if (this.spatialGrid) {
        const neighbors = this.spatialGrid.getNearby(pos, tolerance * ENGINE_CONSTANTS.GRID_FALLBACK_MULT);
        return neighbors.map(n => n.id);
      }
    } catch {
      // Fallback to full list search
    }
    return Array.from(this.organisms.keys());
  }

  private findClosestOrganism(ids: string[], pos: { x: number; y: number; z: number }, tolerance: number): Organism | null {
    let closest: Organism | null = null;
    let minDistSq = tolerance * tolerance;

    for (const id of ids) {
      const org = this.organisms.get(id);
      if (!org || org.isDead) { continue; }

      const distSq = this.calculateDistanceSq(org.position, pos);
      const hitRadius = Math.max(tolerance, org.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_ORG);

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = org;
      }
    }

    return closest || this.findClosestOrganismFallback(pos, tolerance);
  }

  private findClosestOrganismFallback(pos: { x: number; y: number; z: number }, tolerance: number): Organism | null {
    let closest: Organism | null = null;
    let minDistSq = tolerance * tolerance;

    for (const org of this.organisms.values()) {
      if (org.isDead) { continue; }
      const distSq = this.calculateDistanceSq(org.position, pos);
      const hitRadius = Math.max(tolerance, org.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_ORG_FALLBACK);

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = org;
      }
    }
    return closest;
  }

  private calculateDistanceSq(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Пошук їжі за заданими координатами.
   */
  public findFoodAt(pos: { x: number; y: number; z: number }, tolerance: number): Food | null {
    let closest: Food | null = null;
    let minDistSq = tolerance * tolerance;

    for (const food of this.food.values()) {
      if (food.consumed) { continue; }

      const distSq = this.calculateDistanceSq(food.position, pos);
      const hitRadius = Math.max(tolerance, food.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_FOOD);

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = food;
      }
    }
    return closest;
  }

  /**
   * Пошук сутності за індексом рендерингу (Instance ID).
   */
  public getEntityByInstanceId(type: 'prey' | 'predator' | 'food', index: number): Organism | Food | null {
    if (type === 'food') {
      return this.getFoodByInstanceId(index);
    }
    return this.getOrganismByInstanceId(type, index);
  }

  private getFoodByInstanceId(index: number): Food | null {
    let currentIdx = 0;
    for (const food of this.food.values()) {
      if (!food.consumed) {
        if (currentIdx === index) { return food; }
        currentIdx++;
      }
    }
    return null;
  }

  private getOrganismByInstanceId(type: 'prey' | 'predator', index: number): Organism | null {
    const targetType = type === 'prey' ? EntityType.PREY : EntityType.PREDATOR;
    let currentIdx = 0;
    for (const org of this.organisms.values()) {
      if (!org.isDead && org.type === targetType) {
        if (currentIdx === index) { return org; }
        currentIdx++;
      }
    }
    return null;
  }
}
