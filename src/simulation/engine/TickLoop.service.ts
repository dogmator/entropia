import type { Food, Obstacle, Organism } from '@simulation/Entity';
import type { EntityManager } from '@simulation/managers/EntityManager.manager';
import type { GridManager } from '@simulation/managers/GridManager.manager';
import type { DeathProcessor } from '@simulation/services/DeathProcessor.processor';
import type { FoodAnomalyGuard } from '@simulation/services/FoodAnomalyGuard.guard';
import type { SpawnService } from '@simulation/services/Spawn.service';
import type { PopulationStatsAggregation, StatisticsManager } from '@simulation/services/StatisticsManager.manager';
import type { BehaviorSystem } from '@simulation/systems/Behavior.system';
import type { CollisionSystem } from '@simulation/systems/Collision.system';
import type { MetabolismSystem } from '@simulation/systems/Metabolism.system';
import type { PhysicsSystem } from '@simulation/systems/Physics.system';
import type { ReproductionSystem } from '@simulation/systems/Reproduction.system';

import { ENGINE_CONSTANTS } from '@/config';
import type { EventBus } from '@/core';
import type { PerformanceMonitor } from '@/core';
import { logger } from '@/core';
import { Random } from '@/core';
import type { EcologicalZone, SimulationConfig, SimulationEvent } from '@/types';

const MAX_ORGANISM_AGE_TICKS = 5000;
const EXTINCTION_FAILSAFE_TICKS = 180;
const RESOURCE_FAILSAFE_TICKS = 600;
const POPULATION_ALERT_INTERVAL_TICKS = 60;
const ENGINE_STATUS_LOG_INTERVAL_TICKS = 300;

/** Minimum engine contract required for the tick cycle. */
export interface EngineCtx {
    tick: number;           // writable — TickLoop increments it
    foodIdCounter: number;  // writable
    readonly organisms: Map<string, Organism>;
    readonly food: Map<string, Food>;
    readonly obstacles: Map<string, Obstacle>;
    readonly zones: Map<string, EcologicalZone>;
    readonly deadOrganisms: Map<string, Organism>;
    readonly config: SimulationConfig;
    readonly entityManager: EntityManager;
    readonly gridManager: GridManager;
    readonly behaviorSystem: BehaviorSystem;
    readonly physicsSystem: PhysicsSystem;
    readonly metabolismSystem: MetabolismSystem;
    readonly collisionSystem: CollisionSystem;
    readonly reproductionSystem: ReproductionSystem;
    readonly spawnService: SpawnService;
    readonly statisticsManager: StatisticsManager;
    readonly performanceMonitor: PerformanceMonitor;
    readonly deathProcessor: DeathProcessor;
    readonly foodAnomalyGuard: FoodAnomalyGuard;
    readonly eventBus: EventBus;
    stop(): void;
}

export class TickLoop {
    // Failsafe counters live here — they are purely tick-loop state.
    private zeroPopulationTicks = 0;
    private zeroFoodTicks = 0;

    constructor(private readonly ctx: EngineCtx) {}

    // Expose mutable counters for Engine getters/setters and PersistenceService.
    public get tick(): number { return this.ctx.tick; }
    public set tick(v: number) { this.ctx.tick = v; }
    public get foodIdCounter(): number { return this.ctx.foodIdCounter; }
    public set foodIdCounter(v: number) { this.ctx.foodIdCounter = v; }

    /** Template method: defines the canonical sequence of one simulation tick. */
     
    public run(): void {
        const c = this.ctx;
        c.tick++;
        c.reproductionSystem.setTick(c.tick);
        c.foodAnomalyGuard.sanitizeIfNeeded({
            food: c.food,
            obstacles: c.obstacles.values(),
            zones: c.zones.values(),
            tick: c.tick
        });
        this.spawnFood();
        c.gridManager.rebuild(c.entityManager.organisms, c.entityManager.food);

        this.logTick();

        const collisionDeadIds = this.runCoreSystems();
        const endRepro = c.performanceMonitor.startSubsystemTimer('ReproductionSystem');
        const newborns = c.reproductionSystem.checkReproduction(c.organisms, c.config.maxOrganisms);
        endRepro();

         
        const { deadIds, stats } = this.collectAggregation(collisionDeadIds);
        this.logEvents(deadIds.length, newborns.length);

        c.statisticsManager.update({
            aggregation: stats,
            foodSize: c.entityManager.food.size,
            obstacleSize: c.entityManager.obstacles.size,
            tick: c.tick,
            zones: c.zones,
            gridManager: c.gridManager,
            config: c.config,
        });
        c.reproductionSystem.createOffspring(newborns, c.organisms, c.config.maxOrganisms, c.statisticsManager.getStats());
        c.deathProcessor.process(deadIds);

        if (!this.applyFailsafe()) {
            const event: SimulationEvent = {
                type: 'TickUpdated',
                tick: c.tick,
                stats: { ...c.statisticsManager.getStats(), performance: c.performanceMonitor.getCurrentMetrics() },
                deltaTime: 1 / ENGINE_CONSTANTS.TICK_RATE,
            };
            c.eventBus.emit(event);
        }

        c.performanceMonitor.registerTick(performance.now() - c.performanceMonitor.getFrameStartTime());
        c.performanceMonitor.endFrame(c.organisms.size + c.food.size, this.calcDrawCalls());
    }

    private logTick(): void {
        const { organisms, tick } = this.ctx;
        if (organisms.size === 0 && tick % POPULATION_ALERT_INTERVAL_TICKS === 0) {
            logger.warn(`Critical population drop: 0 organisms at tick ${String(tick)}.`, 'Engine');
        } else if (tick % ENGINE_STATUS_LOG_INTERVAL_TICKS === 0) {
            logger.info(`Engine tick ${String(tick)}: ${String(organisms.size)} organisms, ${String(this.ctx.food.size)} food`, 'Engine');
        }
    }

    private runCoreSystems(): string[] {
        const { behaviorSystem, physicsSystem, metabolismSystem, collisionSystem,
            organisms, food, obstacles, zones, tick, performanceMonitor } = this.ctx;
        const end1 = performanceMonitor.startSubsystemTimer('BehaviorSystem');
        behaviorSystem.update(organisms); end1();
        const end2 = performanceMonitor.startSubsystemTimer('PhysicsSystem');
        physicsSystem.update(organisms); end2();
        const end3 = performanceMonitor.startSubsystemTimer('MetabolismSystem');
        metabolismSystem.update(organisms, tick); end3();
        const end4 = performanceMonitor.startSubsystemTimer('CollisionSystem');
        const dead = collisionSystem.update(organisms, food, obstacles, zones, tick); end4();
        return dead;
    }

    private collectAggregation(collisionDeadIds: string[]): { deadIds: string[]; stats: PopulationStatsAggregation } {
        const { organisms, metabolismSystem, statisticsManager } = this.ctx;
        const deadIds = new Set(collisionDeadIds);
        const prev = statisticsManager.getStats();
        const stats: PopulationStatsAggregation = {
            preyCount: 0, predatorCount: 0, totalEnergy: 0,
            preyEnergy: 0, predatorEnergy: 0, organismCount: 0,
            maxAge: prev.maxAge, maxGeneration: prev.maxGeneration,
        };

        organisms.forEach(org => {
            if (!org.isDead && metabolismSystem.isOld(org, MAX_ORGANISM_AGE_TICKS)) { org.die('old_age'); }
            stats.organismCount++;
            stats.totalEnergy += org.energy;
            if (org.isPrey) { stats.preyCount++; stats.preyEnergy += org.energy; }
            else { stats.predatorCount++; stats.predatorEnergy += org.energy; }
            if (org.age > stats.maxAge) stats.maxAge = org.age;
            if (org.genome.generation > stats.maxGeneration) stats.maxGeneration = org.genome.generation;
            if (org.isDead) deadIds.add(org.id);
        });

        return { deadIds: Array.from(deadIds), stats };
    }

    private logEvents(deadCount: number, newbornCount: number): void {
        if (deadCount === 0 && newbornCount === 0) return;
        const parts: string[] = [];
        if (deadCount > 0) parts.push(`${String(deadCount)} died`);
        if (newbornCount > 0) parts.push(`${String(newbornCount)} born`);
        const s = this.ctx.statisticsManager.getStats();
        logger.info(`Population: ${parts.join(', ')} [P:${String(s.preyCount)} Pr:${String(s.predatorCount)} F:${String(s.foodCount)}]`, 'Engine');
    }

    /** Returns true if simulation was halted by a failsafe this tick. */
    private applyFailsafe(): boolean {
        const { organisms, food } = this.ctx;
        this.zeroPopulationTicks = organisms.size === 0 ? this.zeroPopulationTicks + 1 : 0;
        this.zeroFoodTicks = food.size === 0 ? this.zeroFoodTicks + 1 : 0;

        if (this.zeroPopulationTicks >= EXTINCTION_FAILSAFE_TICKS) {
            logger.warn('Fail-safe: extinction detected, engine paused', 'Engine', { tick: this.ctx.tick });
            this.ctx.stop();
            return true;
        }
        if (this.zeroFoodTicks >= RESOURCE_FAILSAFE_TICKS && organisms.size > 0) {
            logger.warn('Fail-safe: resource depletion detected', 'Engine', { tick: this.ctx.tick });
            this.spawnFood();
            this.zeroFoodTicks = 0;
        }
        return false;
    }

    private spawnFood(): void {
        const { food, config, spawnService, entityManager } = this.ctx;
        if (food.size >= config.maxFood) return;
        if (Random.next() < config.foodSpawnRate) {
            const item = spawnService.spawnFood(++this.ctx.foodIdCounter);
            if (item) entityManager.addFood(item);
        }
    }

    private calcDrawCalls(): number {
        const { organisms, food, obstacles, zones, config } = this.ctx;
        return organisms.size + food.size + (config.showObstacles ? obstacles.size : 0) + zones.size;
    }

    public resetFailsafeCounters(): void {
        this.zeroPopulationTicks = 0;
        this.zeroFoodTicks = 0;
    }
}
