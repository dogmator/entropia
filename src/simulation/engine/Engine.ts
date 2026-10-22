import type { Food, Obstacle, Organism } from '@simulation/Entity';
import type { IPersistableEngine } from '@simulation/interfaces/IPersistableEngine';
import { EntityManager, GridManager } from '@simulation/managers';
import { CameraDataProvider } from '@simulation/providers';
import { BufferManager } from '@simulation/services/BufferManager.manager';
import { DeathProcessor } from '@simulation/services/DeathProcessor.processor';
import { 
    buildInitialPopulation, 
    buildObstacles, 
    buildZones 
} from '@simulation/services/EnvironmentBuilder.builder';
import { FoodAnomalyGuard } from '@simulation/services/FoodAnomalyGuard.guard';
import { PersistenceService } from '@simulation/services/Persistence.service';
import { ResourceStock } from '@simulation/services/ResourceStock.service';
import { SpawnService } from '@simulation/services/Spawn.service';
import { StatisticsManager } from '@simulation/services/StatisticsManager.manager';
import { BehaviorSystem } from '@simulation/systems/Behavior.system';
import { CollisionSystem } from '@simulation/systems/Collision.system';
import { MetabolismSystem } from '@simulation/systems/Metabolism.system';
import { PhysicsSystem } from '@simulation/systems/Physics.system';
import { ReproductionSystem } from '@simulation/systems/Reproduction.system';

import { createWorldConfig, ENGINE_CONSTANTS, GENETICS, INITIAL_VIS_CONFIG, PHYSICS, REPRODUCTION_ENERGY_THRESHOLD } from '@/config';
import { EventBus, logger, PerformanceMonitor, RandomStream } from '@/core';
import type {
    CameraData, EcologicalZone, FailsafeCounters, GeneticTreeNode, GenomeId, RenderBuffers,
    SerializedSimulationStateV1, SimulationConfig, SimulationEvent, SimulationStats, WorldConfig,
} from '@/types';
import { EngineState } from '@/types';

import { EntityQuery } from './EntityQuery.service';
import { TickLoop } from './TickLoop.service';

/** Food and energy accounting of the resource pilot. For measurement: it is not part of a snapshot. */
export interface ResourceLedger {
    readonly enabled: boolean;
    /** Food units the zones regained since the world was created or restored. */
    readonly unitsRegenerated: number;
    /** Food units paid into food items. */
    readonly unitsSpent: number;
    /** Food attempts refused because the owning zone had too little stock. */
    readonly attemptsRefused: number;
    /** Energy eaten by organisms. */
    readonly energyAbsorbed: number;
    /** Energy left in food that a bite consumed. */
    readonly energyDiscarded: number;
    /** Energy of food removed by the anomaly guard. */
    readonly energyRemoved: number;
    /** Energy charged to organisms for metabolism. A requested amount, not a measured loss. */
    readonly energyRequested: number;
    /** Energy still held by live food items. */
    readonly foodEnergyRemaining: number;
}

export class SimulationEngine implements IPersistableEngine {
    public state: EngineState = EngineState.INITIALIZING;

    // Public collections (read by PersistenceService and worker)
    public readonly zones = new Map<string, EcologicalZone>();
    public readonly deadOrganisms = new Map<string, Organism>();
    public readonly geneticTree = new Map<GenomeId, GeneticTreeNode>();
    public readonly geneticRoots: GenomeId[] = [];

    // Counters — owned by TickLoop but exposed here for persistence compat
    public get tick(): number { return this.tickLoop.tick; }
    public set tick(v: number) { this.tickLoop.tick = v; }
    public get foodIdCounter(): number { return this.tickLoop.foodIdCounter; }
    public set foodIdCounter(v: number) { this.tickLoop.foodIdCounter = v; }
    public obstacleIdCounter = 0;
    public seed: number;
    // Owned by this engine only. Systems and factories receive this instance, so no other engine can reset it.
    public readonly random: RandomStream;

    // Systems and managers — public for PersistenceService and tests
    public readonly entityManager: EntityManager;
    public readonly gridManager: GridManager;
    public readonly eventBus: EventBus;
    public readonly performanceMonitor: PerformanceMonitor;
    public readonly bufferManager: BufferManager;
    public readonly statisticsManager: StatisticsManager;
    public readonly behaviorSystem: BehaviorSystem;
    public readonly physicsSystem: PhysicsSystem;
    public readonly metabolismSystem: MetabolismSystem;
    public readonly collisionSystem: CollisionSystem;
    public readonly reproductionSystem: ReproductionSystem;
    public readonly spawnService: SpawnService;
    public readonly cameraDataProvider: CameraDataProvider;
    /** Finite food per zone. Off unless the world was created with the resourceStock option (stage J pilot). */
    public readonly resourceStock: ResourceStock;
    public config: SimulationConfig;
    public worldConfig: WorldConfig;

    public get organisms(): Map<string, Organism> { return this.entityManager.organisms; }
    public get food(): Map<string, Food> { return this.entityManager.food; }
    public get obstacles(): Map<string, Obstacle> { return this.entityManager.obstacles; }

    private readonly foodAnomalyGuard: FoodAnomalyGuard;
    private readonly tickLoop: TickLoop;
    private readonly entityQuery: EntityQuery;
    private worldScale: number;

    // eslint-disable-next-line max-lines-per-function
    constructor(scale = 1.0, options?: { seed?: number; resourceStock?: boolean }) {
        const seed = options?.seed ?? ((Math.random() * ENGINE_CONSTANTS.SEED_LIMIT) >>> 0); // eslint-disable-line sonarjs/pseudo-random
        this.seed = seed >>> 0;
        this.random = new RandomStream(this.seed);
        this.worldConfig = createWorldConfig(scale);
        this.worldScale = scale;
        this.config = this.buildDefaultConfig();

        logger.info('Initializing SimulationEngine', 'Engine', { seed: this.seed, scale });

        this.eventBus = new EventBus();
        this.gridManager = new GridManager(this.worldConfig.WORLD_SIZE, ENGINE_CONSTANTS.SPATIAL_GRID_CELL_SIZE);
        this.entityManager = new EntityManager(this.gridManager);
        this.cameraDataProvider = new CameraDataProvider();

        this.physicsSystem = new PhysicsSystem(this.worldConfig);
        this.metabolismSystem = new MetabolismSystem();
        this.collisionSystem = new CollisionSystem(this.gridManager, this.eventBus, this.worldConfig, this.random);
        this.behaviorSystem = new BehaviorSystem(this.gridManager, { config: this.config, zones: this.zones, worldConfig: this.worldConfig });
        this.foodAnomalyGuard = new FoodAnomalyGuard(this.worldConfig);

        buildZones(this.worldConfig, this.zones);
        this.resourceStock = new ResourceStock();
        this.resourceStock.reset(this.zones.values(), { enabled: options?.resourceStock === true, stocks: undefined });
        this.obstacleIdCounter = buildObstacles(this.worldConfig, this.entityManager, this.obstacleIdCounter, this.random);
        this.gridManager.initializeStatic(this.entityManager.obstacles);

        this.spawnService = new SpawnService(this.eventBus, this.gridManager, this.zones, this.obstacles, this.random, {}, this.worldConfig);
        this.performanceMonitor = new PerformanceMonitor();
        this.bufferManager = new BufferManager(true);
        this.statisticsManager = new StatisticsManager(this.worldConfig);

        this.reproductionSystem = new ReproductionSystem({
            config: this.config,
            organismFactory: this.spawnService.getFactory(),
            eventBus: this.eventBus,
            geneticTree: this.geneticTree,
            geneticRoots: this.geneticRoots,
            initialTick: 0,
        });

        const deathProcessor = new DeathProcessor({
            entityManager: this.entityManager,
            deadOrganisms: this.deadOrganisms,
            eventBus: this.eventBus,
            reproductionSystem: this.reproductionSystem,
            statisticsManager: this.statisticsManager,
        });

        // Expose tick/foodIdCounter as properties on the ctx object so
        // PersistenceService can write them via the Engine setters above.
        const tickCtx = {
            tick: 0, foodIdCounter: 0,
            organisms: this.organisms, food: this.food, obstacles: this.obstacles,
            zones: this.zones, deadOrganisms: this.deadOrganisms, config: this.config, random: this.random,
            entityManager: this.entityManager, gridManager: this.gridManager,
            behaviorSystem: this.behaviorSystem, physicsSystem: this.physicsSystem,
            metabolismSystem: this.metabolismSystem, collisionSystem: this.collisionSystem,
            reproductionSystem: this.reproductionSystem, spawnService: this.spawnService,
            statisticsManager: this.statisticsManager, performanceMonitor: this.performanceMonitor,
            deathProcessor, foodAnomalyGuard: this.foodAnomalyGuard, resourceStock: this.resourceStock, eventBus: this.eventBus,
            stop: () => { this.stop(); },
        };
        this.tickLoop = new TickLoop(tickCtx);

        this.entityQuery = new EntityQuery({
            entityManager: this.entityManager,
            deadOrganisms: this.deadOrganisms,
            zones: this.zones,
            geneticTree: this.geneticTree,
            geneticRoots: this.geneticRoots,
        });

        buildInitialPopulation({
            spawnService: this.spawnService,
            entityManager: this.entityManager,
            reproductionSystem: this.reproductionSystem,
            worldConfig: this.worldConfig
        });
        this.state = EngineState.READY;
        logger.info('SimulationEngine READY', 'Engine');
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public start(): void {
        if (this.state === EngineState.RUNNING) return;
        if (this.state !== EngineState.READY && this.state !== EngineState.PAUSED) {
            logger.warn(`Cannot start engine from state ${this.state}`, 'Engine');
            return;
        }
        this.state = EngineState.RUNNING;
        this.performanceMonitor.setMonitoringEnabled(true);
        logger.info('SimulationEngine STARTED', 'Engine');
    }

    public stop(): void {
        if (this.state === EngineState.RUNNING) {
            this.state = EngineState.PAUSED;
            this.performanceMonitor.setMonitoringEnabled(false);
            logger.info('SimulationEngine PAUSED', 'Engine');
        }
    }

    public reset(): void {
        logger.info('engine reset requested', 'Engine:Reset');

        this.entityManager.clear();
        this.zones.clear();
        this.geneticTree.clear();
        this.geneticRoots.length = 0;
        this.gridManager.clear();
        this.obstacleIdCounter = 0;
        this.tickLoop.tick = 0;
        this.tickLoop.foodIdCounter = 0;
        this.tickLoop.resetFailsafeCounters();
        this.foodAnomalyGuard.reset();
        this.statisticsManager.reset();
        this.spawnService.resetFactory();
        this.bufferManager.reset();
        this.eventBus.clearHistory();
        buildZones(this.worldConfig, this.zones);
        this.resourceStock.reset(this.zones.values(), { enabled: this.resourceStock.isEnabled, stocks: undefined });
        this.resetResourceLedger();
        this.obstacleIdCounter = buildObstacles(this.worldConfig, this.entityManager, this.obstacleIdCounter, this.random);
        // The static grid is built from obstacles only, so it must follow every regeneration of them.
        this.gridManager.initializeStatic(this.entityManager.obstacles);
        buildInitialPopulation({
            spawnService: this.spawnService,
            entityManager: this.entityManager,
            reproductionSystem: this.reproductionSystem,
            worldConfig: this.worldConfig
        });

        logger.info('engine reset complete', 'Engine:Reset', {
            organisms: this.entityManager.organisms.size,
            food: this.entityManager.food.size,
            obstacles: this.entityManager.obstacles.size,
        });
    }

    // ── Main update loop (Facade delegates to TickLoop) ──────────────────────

    public update(): void {
        this.performanceMonitor.beginFrame();
        if (this.state !== EngineState.RUNNING) return;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!this.organisms || !this.food || !this.obstacles) {
            logger.error('CRITICAL: Entity collections undefined in Engine.update', 'Engine');
            return;
        }
        this.tickLoop.run();
    }

    // ── Data access ───────────────────────────────────────────────────────────

    public getRenderData(): RenderBuffers {
        return this.bufferManager.getRenderData(this.organisms, this.deadOrganisms, this.food);
    }

    public getStats(): SimulationStats { return this.statisticsManager.getStats(); }
    public getStatsWithWorldData(): SimulationStats { return this.getStats(); }
    public getTick(): number { return this.tickLoop.tick; }
    public getSeed(): number { return this.seed; }
    public setSeed(seed: number): void { this.seed = seed >>> 0; this.random.reset(this.seed); }
    public getZones(): Map<string, EcologicalZone> { return this.entityQuery.getZones(); }
    public getPerformanceMonitor(): PerformanceMonitor { return this.performanceMonitor; }
    public getGeneticTree(): ReturnType<typeof this.reproductionSystem.getGeneticTreeInfo> {
        return this.reproductionSystem.getGeneticTreeInfo();
    }

    public setCameraData(cameraData: CameraData): void {
        this.cameraDataProvider.setCameraData(cameraData);
        this.statisticsManager.setCameraData(cameraData);
    }

    public addEventListener(callback: (event: SimulationEvent) => void): () => void {
        type EventCallback = (event: SimulationEvent) => void;
        return this.eventBus.on('TickUpdated', callback as EventCallback);
    }

    // ── Entity queries (delegate to EntityQuery) ──────────────────────────────

    public findEntityAt(pos: { x: number; y: number; z: number }, tolerance: number): Promise<Organism | null> {
        return this.entityQuery.findEntityAt(pos, tolerance);
    }

    public findFoodAt(pos: { x: number; y: number; z: number }, tolerance: number): Food | null {
        return this.entityQuery.findFoodAt(pos, tolerance);
    }

    public getEntityByInstanceId(type: 'prey' | 'predator' | 'food', index: number, isDead = false): Promise<Organism | Food | null> {
        return this.entityQuery.getEntityByInstanceId(type, index, isDead);
    }

    public getGeneticNode(genomeId: GenomeId): Promise<unknown> {
        return this.entityQuery.getGeneticNode(genomeId);
    }

    public getGeneticRoots(): Promise<GenomeId[]> {
        return this.entityQuery.getGeneticRoots();
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    public exportState(): SerializedSimulationStateV1 { return PersistenceService.exportState(this); }
    public importState(state: SerializedSimulationStateV1): void {
        PersistenceService.importState(this, state);
        // Bodies of the previous world are not part of the snapshot, so they must not outlive the import.
        this.deadOrganisms.clear();
        this.foodAnomalyGuard.reset();
        this.resetResourceLedger();
    }
    public getFailsafeCounters(): FailsafeCounters { return this.tickLoop.getFailsafeCounters(); }
    public setFailsafeCounters(counters: FailsafeCounters): void { this.tickLoop.setFailsafeCounters(counters); }

    /** Food and energy accounting of the resource pilot, since the world was created or restored. For measurement. */
    public getResourceLedger(): ResourceLedger {
        const foodEnergyRemaining = Array.from(this.food.values()).reduce((sum, item) => sum + item.currentEnergy, 0);
        return {
            enabled: this.resourceStock.isEnabled,
            unitsRegenerated: this.resourceStock.unitsRegenerated,
            unitsSpent: this.resourceStock.unitsSpent,
            attemptsRefused: this.resourceStock.attemptsRefused,
            energyAbsorbed: this.collisionSystem.energyAbsorbed,
            energyDiscarded: this.collisionSystem.energyDiscarded,
            energyRemoved: this.foodAnomalyGuard.energyRemoved,
            energyRequested: this.metabolismSystem.energyRequested,
            foodEnergyRemaining,
        };
    }

    private resetResourceLedger(): void {
        this.collisionSystem.energyAbsorbed = 0;
        this.collisionSystem.energyDiscarded = 0;
        this.metabolismSystem.energyRequested = 0;
        this.foodAnomalyGuard.energyRemoved = 0;
    }
    public getWorldScale(): number { return this.worldScale; }

    public updateWorldScale(scale: number): void {
        logger.warning('Direct updateWorldScale not supported in-place. Re-create Engine instance.', 'Engine');
        this.worldConfig = createWorldConfig(scale);
        this.worldScale = scale;
    }

    public mapVector3(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
        return { x: v.x, y: v.y, z: v.z };
    }

    private buildDefaultConfig(): SimulationConfig {
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
}
