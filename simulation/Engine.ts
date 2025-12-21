/**
 * EVOSIM 3D — Рефакторений Симуляційний Движок
 *
 * Оркестратор систем з чистою архітектурою:
 * - EventBus для подій
 * - BehaviorSystem для AI
 * - PhysicsSystem для руху
 * - MetabolismSystem для енергії
 * - CollisionSystem для зіткнень
 * - ReproductionSystem для генетики
 */

import {
  EntityType,
  OrganismId,
  FoodId,
  SimulationEvent,
  SimulationStats,
  SimulationConfig,
  EcologicalZone,
  ZoneType,
  GeneticTreeNode,
  GenomeId,
} from '../types';
import {
  WORLD_SIZE,
  INITIAL_PREY,
  INITIAL_PREDATOR,
  MAX_FOOD,
  FOOD_SPAWN_RATE,
  MAX_TOTAL_ORGANISMS,
  INITIAL_VIS_CONFIG,
  ZONE_DEFAULTS,
  GENETICS,
  PHYSICS,
  REPRODUCTION_ENERGY_THRESHOLD,
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

// ============================================================================
// РЕФАКТОРЕНИЙ ДВИЖОК
// ============================================================================

export class SimulationEngine {
  // Колекції сутностей
  public readonly organisms: Map<string, Organism> = new Map();
  public readonly food: Map<string, Food> = new Map();
  public readonly obstacles: Map<string, Obstacle> = new Map();
  public readonly zones: Map<string, EcologicalZone> = new Map();

  // Генетичне дерево
  public readonly geneticTree: Map<GenomeId, GeneticTreeNode> = new Map();
  public readonly geneticRoots: GenomeId[] = [];

  // Системи (замість монолітного коду)
  private readonly eventBus: EventBus;
  private readonly spatialGrid: SpatialHashGrid;
  private readonly physicsSystem: PhysicsSystem;
  private readonly metabolismSystem: MetabolismSystem;
  private readonly collisionSystem: CollisionSystem;
  private readonly behaviorSystem: BehaviorSystem;
  private readonly reproductionSystem: ReproductionSystem;

  // Сервіси
  private readonly spawnService: SpawnService;

  // Лічильники
  private foodIdCounter: number = 0;
  private obstacleIdCounter: number = 0;
  private tick: number = 0;

  // Статистика
  private stats = {
    totalDeaths: 0,
    totalBirths: 0,
    maxAge: 0,
    maxGeneration: 1,
  };

  // Конфігурація
  public config: SimulationConfig;

  constructor() {
    this.config = this.createDefaultConfig();

    // Ініціалізація систем
    this.eventBus = new EventBus();
    this.spatialGrid = new SpatialHashGrid();
    this.physicsSystem = new PhysicsSystem(this.config);
    this.metabolismSystem = new MetabolismSystem();
    this.collisionSystem = new CollisionSystem(this.spatialGrid, this.eventBus);
    this.behaviorSystem = new BehaviorSystem(this.spatialGrid, this.config, this.zones);

    // Ініціалізувати зони перед створенням сервісів
    this.createZones();
    this.createObstacles();

    // Створити сервіси
    this.spawnService = new SpawnService(
      this.eventBus,
      this.spatialGrid,
      this.zones,
      this.obstacles
    );

    // Створити систему репродукції з фабрикою зі SpawnService
    this.reproductionSystem = new ReproductionSystem(
      this.config,
      this.spawnService.getFactory(),
      this.eventBus,
      this.geneticTree,
      this.geneticRoots,
      this.tick
    );

    // Створити початкову популяцію
    this.createInitialPopulation();
  }

  // ============================================================================
  // ІНІЦІАЛІЗАЦІЯ
  // ============================================================================

  private createDefaultConfig(): SimulationConfig {
    return {
      foodSpawnRate: FOOD_SPAWN_RATE,
      maxFood: MAX_FOOD,
      maxOrganisms: MAX_TOTAL_ORGANISMS,
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


  /** Створити екологічні зони */
  private createZones(): void {
    this.zones.set('oasis_center', {
      id: 'oasis_center',
      type: ZoneType.OASIS,
      center: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, z: WORLD_SIZE / 2 },
      radius: WORLD_SIZE * 0.15,
      foodMultiplier: ZONE_DEFAULTS.OASIS.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.OASIS.dangerMultiplier,
    });

    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: WORLD_SIZE, y: WORLD_SIZE, z: WORLD_SIZE },
    ];
    corners.forEach((pos, i) => {
      this.zones.set(`desert_${i}`, {
        id: `desert_${i}`,
        type: ZoneType.DESERT,
        center: pos,
        radius: WORLD_SIZE * 0.2,
        foodMultiplier: ZONE_DEFAULTS.DESERT.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.DESERT.dangerMultiplier,
      });
    });

    this.zones.set('hunting_ground', {
      id: 'hunting_ground',
      type: ZoneType.HUNTING_GROUND,
      center: { x: WORLD_SIZE * 0.75, y: WORLD_SIZE / 2, z: WORLD_SIZE * 0.25 },
      radius: WORLD_SIZE * 0.12,
      foodMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.dangerMultiplier,
    });

    this.zones.set('sanctuary', {
      id: 'sanctuary',
      type: ZoneType.SANCTUARY,
      center: { x: WORLD_SIZE * 0.25, y: WORLD_SIZE / 2, z: WORLD_SIZE * 0.75 },
      radius: WORLD_SIZE * 0.1,
      foodMultiplier: ZONE_DEFAULTS.SANCTUARY.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.SANCTUARY.dangerMultiplier,
    });
  }

  /** Створити початкові перешкоди */
  private createObstacles(): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const radius = 12 + Math.random() * 25;
      const obstacle = Obstacle.create(
        ++this.obstacleIdCounter,
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        radius
      );
      this.obstacles.set(obstacle.id, obstacle);
    }
  }

  /** Створити початкову популяцію */
  private createInitialPopulation(): void {
    for (let i = 0; i < INITIAL_PREY; i++) {
      const organism = this.spawnService.spawnOrganism(EntityType.PREY);
      if (organism) {
        this.organisms.set(organism.id, organism);
        // Додати до генетичного дерева
        this.reproductionSystem['addToGeneticTree'](organism, undefined);
      }
    }
    for (let i = 0; i < INITIAL_PREDATOR; i++) {
      const organism = this.spawnService.spawnOrganism(EntityType.PREDATOR);
      if (organism) {
        this.organisms.set(organism.id, organism);
        // Додати до генетичного дерева
        this.reproductionSystem['addToGeneticTree'](organism, undefined);
      }
    }
  }

  // ============================================================================
  // ПУБЛІЧНІ МЕТОДИ
  // ============================================================================

  /** Скинути симуляцію */
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
    this.eventBus.clear();
    this.createZones();
    this.createObstacles();
    this.createInitialPopulation();
  }

  /** Підписатися на події */
  public addEventListener(callback: (event: SimulationEvent) => void): () => void {
    // EventBus.on приймає конкретний тип події, але addEventListener дозволяє слухати всі події
    // Тому використовуємо type assertion до EventCallback
    type EventCallback = (event: SimulationEvent) => void;
    return this.eventBus.on('TickUpdated', callback as EventCallback);
  }

  /** Головний цикл оновлення - РЕФАКТОРЕНА ВЕРСІЯ */
  public update(): void {
    this.tick++;
    this.reproductionSystem.setTick(this.tick);

    // Спавн їжі
    this.spawnFood();

    // Перебудувати просторову сітку
    this.rebuildGrid();

    // Застосувати системи до всіх організмів
    this.behaviorSystem.update(this.organisms);
    this.physicsSystem.update(this.organisms);
    this.metabolismSystem.update(this.organisms, this.tick);

    // Обробити колізії
    const deadIds = this.collisionSystem.update(this.organisms, this.food, this.obstacles);

    // Перевірити розмноження
    const newborns = this.reproductionSystem.checkReproduction(this.organisms);

    // Оновити статистику
    this.updateStats();

    // Створити нащадків
    this.reproductionSystem.createOffspring(newborns, this.organisms, this.config.maxOrganisms, this.stats);

    // Обробити смерті
    this.processDeaths(deadIds);

    // Відправка оновлення стану
    this.eventBus.emit({
      type: 'TickUpdated',
      tick: this.tick,
      stats: this.calculateStats(),
      deltaTime: 1 / 60,
    });
  }

  // ============================================================================
  // СПАВН СУТНОСТЕЙ
  // ============================================================================


  /** Спавн їжі */
  private spawnFood(): void {
    if (this.food.size >= this.config.maxFood) return;

    if (Math.random() < this.config.foodSpawnRate) {
      const food = this.spawnService.spawnFood(++this.foodIdCounter);
      if (food) {
        this.food.set(food.id, food);
      }
    }
  }

  // ============================================================================
  // ДОПОМІЖНІ МЕТОДИ
  // ============================================================================

  /** Оновити статистику */
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

  /** Обробити смерті */
  private processDeaths(deadIds: string[]): void {
    for (const id of deadIds) {
      const org = this.organisms.get(id);
      if (org) {
        this.stats.totalDeaths++;

        // Оновити генетичне дерево
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

  /** Перебудувати просторову сітку */
  private rebuildGrid(): void {
    this.spatialGrid.clear();

    this.organisms.forEach(o => {
      if (!o.isDead) {
        this.spatialGrid.insert({
          id: o.id,
          position: o.position,
          type: o.type,
          radius: o.radius,
        });
      }
    });

    this.food.forEach(f => {
      if (!f.consumed) {
        this.spatialGrid.insert({
          id: f.id,
          position: f.position,
          type: f.type,
          radius: f.radius,
        });
      }
    });

    if (this.config.showObstacles) {
      this.obstacles.forEach(ob => {
        this.spatialGrid.insert({
          id: ob.id,
          position: ob.position,
          type: ob.type,
          radius: ob.radius,
        });
      });
    }
  }

  /** Розрахувати статистику */
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

  /** Отримати поточний тік */
  public getTick(): number {
    return this.tick;
  }

  /** Отримати генетичне дерево для візуалізації */
  public getGeneticTree() {
    return this.reproductionSystem.getGeneticTreeInfo();
  }
}
