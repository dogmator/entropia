import { WORLD_SIZE } from '@/config';
import { Random } from '@/core/utils/Random';
import type {
    GeneticTreeNode,
    Genome,
    GenomeId,
    OrganismId,
    SerializedGenome,
    SerializedSimulationStateV1,
    SimulationStats,
    Vector3,
} from '@/types';
import {
    createFoodId,
    createObstacleId,
} from '@/types';
import { isPredatorGenome,isPreyGenome } from '@/types';

import { Food, Obstacle, Organism } from '../Entity';
import { IPersistableEngine } from '../interfaces/IPersistableEngine';
import { isPositionBlockedByAnomalies } from '../utils/AnomalyValidation';
import type { PopulationStatsAggregation } from './StatisticsManager';

interface PersistedOrganismRuntime {
    causeOfDeath?: Organism['causeOfDeath'];
    huntSuccessCount?: number;
}

interface FoodAnomalyCheckParams {
    position: Vector3;
    zones: Iterable<{ center: Vector3; radius: number }>;
    obstacles: Iterable<{ position: Vector3; radius: number }>;
    worldSize: number;
}

export class PersistenceService {
    private static readonly FOOD_ANOMALY_PADDING = 5;

    private static resolveWorldSize(engine: IPersistableEngine): number {
        const worldConfig = (engine as IPersistableEngine & { worldConfig?: { WORLD_SIZE?: number } }).worldConfig;
        const candidate = worldConfig?.WORLD_SIZE;
        return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
            ? candidate
            : WORLD_SIZE;
    }

    private static isFoodBlockedByAnomaly(params: FoodAnomalyCheckParams): boolean {
        const {
            position,
            zones,
            obstacles,
            worldSize,
        } = params;
        const minDistance = PersistenceService.FOOD_ANOMALY_PADDING;
        return isPositionBlockedByAnomalies({
            position,
            obstacles,
            zones,
            worldSize,
            obstaclePadding: minDistance,
            zonePadding: minDistance,
            checkZones: true,
        });
    }

    // eslint-disable-next-line max-lines-per-function
    public static exportState(engine: IPersistableEngine): SerializedSimulationStateV1 {
        const factory = engine.spawnService.getFactory();

        const state: SerializedSimulationStateV1 = {
            version: 1,
            seed: engine.seed,
            rngState: Random.getState(),
            tick: engine.tick,
            counters: {
                foodIdCounter: engine.foodIdCounter,
                obstacleIdCounter: engine.obstacleIdCounter,
                organismIdCounter: factory.getIdCounter(),
                genomeIdCounter: factory.getGenomeIdCounter(),
            },
            stats: {
                totalDeaths: engine.getStats().totalDeaths,
                totalBirths: engine.getStats().totalBirths,
                maxAge: engine.getStats().maxAge,
                maxGeneration: engine.getStats().maxGeneration,
            },
            config: engine.config,
            zones: Array.from(engine.zones.values()).map(z => ({
                id: z.id,
                type: z.type,
                center: engine.mapVector3(z.center),
                radius: z.radius,
                foodMultiplier: z.foodMultiplier,
                dangerMultiplier: z.dangerMultiplier,
            })),
            obstacles: Array.from(engine.obstacles.values()).map(o => ({
                id: o.id,
                position: engine.mapVector3(o.position),
                radius: o.radius,
                color: o.color,
                opacity: o.opacity,
                isWireframe: o.isWireframe,
            })),
            food: Array.from(engine.food.values()).map(f => ({
                id: f.id,
                position: engine.mapVector3(f.position),
                radius: f.radius,
                baseRadius: f.baseRadius,
                energyValue: f.energyValue,
                maxEnergy: f.maxEnergy,
                currentEnergy: f.currentEnergy,
                spawnTime: f.spawnTime,
                consumed: f.consumed,
            })),
            organisms: Array.from(engine.organisms.values()).map(o => {
                const persistedOrganism = o as Organism & PersistedOrganismRuntime;

                return ({
                id: o.id,
                type: o.type as 'PREY' | 'PREDATOR',
                position: engine.mapVector3(o.position),
                velocity: engine.mapVector3(o.velocity),
                acceleration: engine.mapVector3(o.acceleration),
                radius: o.radius,
                adultRadius: o.adultRadius,
                growthRatio: o.growthRatio,
                maturityRatio: o.maturityRatio,
                stuckTicks: o.stuckTicks,
                energy: o.energy,
                age: o.age,
                state: o.state,
                isDead: o.isDead,
                causeOfDeath: persistedOrganism.causeOfDeath ?? null,
                trailEnabled: o.trailEnabled,
                parentOrganismId: o.parentOrganismId,
                huntSuccessCount: persistedOrganism.huntSuccessCount ?? 0,
                lastActiveAt: o.lastActiveAt,
                genome: {
                    id: o.genome.id,
                    parentId: o.genome.parentId,
                    generation: o.genome.generation,
                    type: o.genome.type,
                    color: o.genome.color,
                    maxSpeed: o.genome.maxSpeed,
                    senseRadius: o.genome.senseRadius,
                    metabolism: o.genome.metabolism,
                    size: o.genome.size,
                    asymmetry: o.genome.asymmetry,
                    spikiness: o.genome.spikiness,
                    glowIntensity: o.genome.glowIntensity,
                    ...(isPreyGenome(o.genome) ? { flockingStrength: o.genome.flockingStrength } : {}),
                    ...(isPredatorGenome(o.genome) ? {
                        subtype: o.genome.subtype,
                        attackPower: o.genome.attackPower,
                        packAffinity: o.genome.packAffinity
                    } : {}),
                } as SerializedGenome
            });
            }),
            geneticTree: {
                roots: engine.geneticRoots.map(id => String(id)),
                nodes: Array.from(engine.geneticTree.values()).map(node => ({
                    id: String(node.id),
                    parentId: node.parentId ? String(node.parentId) : null,
                    children: node.children.map(c => String(c)),
                    generation: node.generation,
                    born: node.born,
                    died: node.died,
                    type: node.type,
                    traits: { ...node.traits }
                })),
            },
        };

        return state;
    }

    // eslint-disable-next-line max-lines-per-function
    public static importState(engine: IPersistableEngine, state: SerializedSimulationStateV1): void {
        type EngineMutableShape = IPersistableEngine & {
            seed: number;
            tick: number;
            foodIdCounter: number;
            obstacleIdCounter: number;
            statisticsManager: {
                reset: () => void;
                incrementDeaths: (count: number) => void;
                incrementBirths: (count: number) => void;
                update: (params: {
                    aggregation: PopulationStatsAggregation;
                    foodSize: number;
                    obstacleSize: number;
                    tick: number;
                    zones: Map<string, import('@/types').EcologicalZone>;
                    gridManager: IPersistableEngine['gridManager'];
                    config: import('@/types').SimulationConfig;
                }) => void;
                getStats: () => SimulationStats;
            };
        };

        const mutableEngine = engine as EngineMutableShape;
        const factory = engine.spawnService.getFactory();

        // Скидання систем перед завантаженням стану
        mutableEngine.seed = state.seed >>> 0;
        Random.reset(engine.seed);
        Random.setState(state.rngState >>> 0);
        mutableEngine.tick = state.tick;
        mutableEngine.foodIdCounter = state.counters.foodIdCounter;
        mutableEngine.obstacleIdCounter = state.counters.obstacleIdCounter;

        factory.setIdCounter(state.counters.organismIdCounter);
        factory.setGenomeIdCounter(state.counters.genomeIdCounter);

        engine.eventBus.clearHistory();
        engine.gridManager.clear();

        engine.geneticRoots.length = 0;
        engine.geneticRoots.push(...state.geneticTree.roots.map(id => id as GenomeId));

        engine.geneticTree.clear();
        state.geneticTree.nodes.forEach(node => {
            engine.geneticTree.set(node.id as GenomeId, {
                id: node.id as GenomeId,
                parentId: node.parentId as GenomeId | null,
                children: node.children.map(c => c as GenomeId),
                generation: node.generation,
                born: node.born,
                died: node.died,
                type: node.type,
                traits: { ...node.traits }
            } as GeneticTreeNode);
        });

        engine.zones.clear();
        state.zones.forEach(z => {
            engine.zones.set(z.id, {
                id: z.id,
                type: z.type,
                center: { ...z.center },
                radius: z.radius,
                foodMultiplier: z.foodMultiplier,
                dangerMultiplier: z.dangerMultiplier,
            });
        });

        engine.obstacles.clear();
        state.obstacles.forEach(o => {
            const obstacle = new Obstacle(
                createObstacleId(o.id),
                { ...o.position },
                o.radius,
                o.color,
                o.opacity,
                o.isWireframe
            );
            engine.obstacles.set(o.id, obstacle);
        });

        const worldSize = PersistenceService.resolveWorldSize(engine);

        engine.food.clear();
        state.food.forEach(f => {
            if (PersistenceService.isFoodBlockedByAnomaly({
                position: f.position,
                zones: engine.zones.values(),
                obstacles: engine.obstacles.values(),
                worldSize,
            })) {
                return;
            }

            const food = new Food(
                createFoodId(f.id),
                { ...f.position },
                f.energyValue,
                f.spawnTime
            );
            food.radius = f.radius;
            food.currentEnergy = f.currentEnergy;
            food.consumed = f.consumed;
            engine.food.set(f.id, food);
        });

        engine.organisms.clear();
        state.organisms.forEach(o => {
            const organism = new Organism(
                o.id as OrganismId,
                { ...o.position },
                o.genome as unknown as Genome,
                o.parentOrganismId ? o.parentOrganismId as OrganismId : null,
                o.energy
            );

            organism.velocity = { ...o.velocity };
            organism.acceleration = { ...o.acceleration };
            organism.age = o.age;
            organism.state = o.state;
            organism.trailEnabled = o.trailEnabled;
            organism.lastActiveAt = o.lastActiveAt;
            organism.stuckTicks = o.stuckTicks;
            organism.updateGrowthFromState();

            engine.organisms.set(o.id, organism);
        });

        Random.setState(state.rngState >>> 0);

        mutableEngine.statisticsManager.reset();
        mutableEngine.statisticsManager.incrementDeaths(state.stats.totalDeaths);
       mutableEngine.statisticsManager.incrementBirths(state.stats.totalBirths);
        const aggregation: PopulationStatsAggregation = {
            preyCount: 0,
            predatorCount: 0,
            totalEnergy: 0,
            preyEnergy: 0,
            predatorEnergy: 0,
            organismCount: 0,
            maxAge: 0,
            maxGeneration: 1,
        };

        engine.organisms.forEach(org => {
            aggregation.organismCount++;
            aggregation.totalEnergy += org.energy;

            if (org.isPrey) {
                aggregation.preyCount++;
                aggregation.preyEnergy += org.energy;
            } else {
                aggregation.predatorCount++;
                aggregation.predatorEnergy += org.energy;
            }

            if (org.age > aggregation.maxAge) {
                aggregation.maxAge = org.age;
            }
            if (org.genome.generation > aggregation.maxGeneration) {
                aggregation.maxGeneration = org.genome.generation;
            }
        });

        mutableEngine.statisticsManager.update({
            aggregation,
            foodSize: engine.food.size,
            obstacleSize: engine.obstacles.size,
            tick: engine.tick,
            zones: engine.zones,
            gridManager: engine.gridManager,
            config: engine.config,
        });
    }
}
