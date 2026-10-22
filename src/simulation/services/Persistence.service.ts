import { WORLD_SIZE } from '@/config';
import { logger } from '@/core';
import type {
    EcologicalZone,
    GeneticTreeNode,
    Genome,
    GenomeId,
    OrganismId,
    SerializedGenome,
    SerializedSimulationStateV1,
    SimulationConfig,
    SimulationStats,
    Vector3,
} from '@/types';
import {
    createFoodId,
    createObstacleId,
    EntityType,
    GraphicsQuality,
    PredatorSubtype,
} from '@/types';
import { isPredatorGenome,isPreyGenome } from '@/types';

import { Food, Obstacle, Organism } from '../Entity';
import type { IPersistableEngine } from '../interfaces/IPersistableEngine';
import { FOOD_ANOMALY_PADDING, isPositionBlockedByAnomalies } from '../utils/AnomalyValidation';
import type { PopulationStatsAggregation } from './StatisticsManager.manager';

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isFiniteNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): boolean => Array.isArray(value) && value.every(item => typeof item === 'string');
const requireFiniteFields = (container: Record<string, unknown>, section: string, keys: string[]): void => {
    for (const key of keys) {
        if (!isFiniteNumber(container[key])) throw new Error(`Invalid simulation snapshot: ${section}.${key} must be a finite number`);
    }
};
// Settings that accept only a fixed set of values. Any other value would leave the settings UI without a matching preset.
const CONFIG_CHOICES: Partial<Record<string, readonly unknown[]>> = { graphicsQuality: Object.values(GraphicsQuality) };

// The type of a setting is the type of its current value. A snapshot value of another type would stay in the live config,
// so it is rejected. JSON turns NaN into null, so a null for a number is rejected too.
const matchesSettingType = (current: unknown, value: unknown): boolean => {
    if (typeof current === 'number') return isFiniteNumber(value);
    if (typeof current === 'boolean') return typeof value === 'boolean';
    if (typeof current === 'string') return typeof value === 'string';
    return true;
};

const expectedSetting = (key: string, current: unknown): string => {
    if (typeof current === 'number') return 'a finite number';
    if (typeof current === 'boolean') return 'true or false';
    return CONFIG_CHOICES[key] === undefined ? 'a string' : 'one of the supported values';
};

// Settings a world cannot run with when they are negative. The limits of the settings UI are not used here: they describe the
// default world at scale 1, and the engine scales food and population limits with the world's volume.
const NON_NEGATIVE_SETTINGS: readonly string[] = [
    'foodSpawnRate', 'maxFood', 'maxOrganisms', 'mutationFactor', 'reproductionThreshold',
    'bloomIntensity', 'trailLength', 'organismScale', 'foodScale',
];

// A value outside these limits would reach the simulation as an invalid world, so the snapshot is rejected.
const requireSettingLimits = (key: string, value: unknown): void => {
    if (typeof value !== 'number') return;
    if (NON_NEGATIVE_SETTINGS.includes(key) && value < 0) throw new Error(`Invalid simulation snapshot: config.${key} must not be negative`);
    if (key === 'drag' && (value <= 0 || value > 1)) throw new Error('Invalid simulation snapshot: config.drag must be above 0 and at most 1');
};

// The snapshot's settings replace the live ones, so they are checked before any engine is changed. A key missing from the
// snapshot keeps its current value (legacy snapshots).
const requireConfig = (config: unknown, template: SimulationConfig): void => {
    if (!isRecord(config)) throw new Error('Invalid simulation snapshot: config is missing');
    for (const [key, current] of Object.entries(template)) {
        const value = config[key];
        if (value === undefined) continue;
        const choices = CONFIG_CHOICES[key];
        if (!matchesSettingType(current, value) || (choices !== undefined && !choices.includes(value))) {
            throw new Error(`Invalid simulation snapshot: config.${key} must be ${expectedSetting(key, current)}`);
        }
        requireSettingLimits(key, value);
    }
};
const requireFailsafe = (failsafe: unknown): void => {
    if (!isRecord(failsafe)) throw new Error('Invalid simulation snapshot: failsafe must be an object');
    requireFiniteFields(failsafe, 'failsafe', ['zeroPopulationTicks', 'zeroFoodTicks']);
};
// Entities of a snapshot are placed in the bounds of the scale it was saved at, so it imports only into a world at that scale.
// Optional: snapshots written before the scale was recorded have none, and import at the live scale.
const requireWorldScale = (worldScale: unknown, liveScale: number): void => {
    if (worldScale === undefined) return;
    if (typeof worldScale !== 'number' || !Number.isFinite(worldScale) || worldScale <= 0) {
        throw new Error('Invalid simulation snapshot: worldScale must be a positive number');
    }
    if (worldScale !== liveScale) {
        throw new Error(`Invalid simulation snapshot: it was saved at world scale ${String(worldScale)}, but this world runs at ${String(liveScale)}. Set the world scale to ${String(worldScale)} and import it again.`);
    }
};
const isGeneticTreeLinks = (node: Record<string, unknown>): boolean => typeof node['id'] === 'string'
    && (node['parentId'] === null || typeof node['parentId'] === 'string')
    && isStringArray(node['children']);
const isGeneticTreeValues = (node: Record<string, unknown>): boolean => isFiniteNumber(node['generation'])
    && isFiniteNumber(node['born'])
    && (node['died'] === null || isFiniteNumber(node['died']))
    && Object.values<unknown>(EntityType).includes(node['type']);
const isGeneticTreeNode = (node: unknown): boolean => {
    if (!isRecord(node) || !isGeneticTreeLinks(node) || !isGeneticTreeValues(node)) return false;
    const traits = node['traits'];
    return isRecord(traits) && ['speed', 'sense', 'size'].every(key => isFiniteNumber(traits[key]));
};

// Numeric fields that every genome carries, whatever its type. The exporter writes all of them.
const GENOME_NUMBER_FIELDS = ['generation', 'color', 'maxSpeed', 'senseRadius', 'metabolism', 'size', 'asymmetry', 'spikiness', 'glowIntensity'];

// Checks the genome of the organism at the given index. A missing or invalid field would reach the simulation as
// undefined or NaN values, so the snapshot is rejected before the engine is touched.
const requireGenome = (organism: unknown, index: number): void => {
    const section = `organism ${String(index)} genome`;
    const genome = isRecord(organism) ? organism['genome'] : undefined;
    if (!isRecord(genome)) throw new Error(`Invalid simulation snapshot: ${section} is missing`);
    if (typeof genome['id'] !== 'string') throw new Error(`Invalid simulation snapshot: ${section}.id must be a string`);
    if (genome['parentId'] !== null && typeof genome['parentId'] !== 'string') {
        throw new Error(`Invalid simulation snapshot: ${section}.parentId must be a string or null`);
    }
    if (genome['type'] === EntityType.PREY) {
        requireFiniteFields(genome, section, ['flockingStrength']);
    } else if (genome['type'] === EntityType.PREDATOR) {
        if (!Object.values<unknown>(PredatorSubtype).includes(genome['subtype'])) {
            throw new Error(`Invalid simulation snapshot: ${section}.subtype must be a predator subtype`);
        }
        requireFiniteFields(genome, section, ['attackPower', 'packAffinity']);
    } else {
        throw new Error(`Invalid simulation snapshot: ${section}.type must be PREY or PREDATOR`);
    }
    requireFiniteFields(genome, section, GENOME_NUMBER_FIELDS);
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PersistenceService {
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
        const minDistance = FOOD_ANOMALY_PADDING;
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
            rngState: engine.random.getState(),
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
                // JSON cannot represent -Infinity, the value of a food item that was never bitten.
                lastBiteTick: Number.isFinite(f.lastBiteTick) ? f.lastBiteTick : null,
            })),
            organisms: Array.from(engine.organisms.values()).map(o => {
                const persistedOrganism = o as Organism & PersistedOrganismRuntime;

                return ({
                id: o.id,
                type: o.type,
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
                causeOfDeath: persistedOrganism.causeOfDeath,
                trailEnabled: o.trailEnabled,
                parentOrganismId: o.parentOrganismId,
                huntSuccessCount: persistedOrganism.huntSuccessCount,
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
            failsafe: engine.getFailsafeCounters(),
            worldScale: engine.getWorldScale(),
        };

        return state;
    }

    /**
     * Rejects snapshots this version cannot import. Runs before the engine is touched, and checks every field that
     * importState needs to run to completion or to derive ids, so a rejected snapshot leaves the active engine unchanged.
     */
    private static assertImportable(state: unknown, config: SimulationConfig, liveScale: number): asserts state is SerializedSimulationStateV1 {
        const isVector = (value: unknown): boolean => isRecord(value) && isFiniteNumber(value['x']) && isFiniteNumber(value['y']) && isFiniteNumber(value['z']);
        const requireArray = (container: Record<string, unknown>, key: string): unknown[] => {
            const value = container[key];
            if (!Array.isArray(value)) throw new Error(`Invalid simulation snapshot: ${key} must be an array`);
            return value;
        };

        if (!isRecord(state)) throw new Error('Invalid simulation snapshot: not an object');
        if (state['version'] !== 1) throw new Error(`Unsupported simulation snapshot version: ${String(state['version'])}`);
        for (const key of ['seed', 'rngState', 'tick']) {
            if (!isFiniteNumber(state[key])) throw new Error(`Invalid simulation snapshot: ${key} must be a finite number`);
        }
        const counters = state['counters'];
        const stats = state['stats'];
        const geneticTree = state['geneticTree'];
        if (!isRecord(counters)) throw new Error('Invalid simulation snapshot: counters is missing');
        if (!isRecord(stats)) throw new Error('Invalid simulation snapshot: stats is missing');
        if (!isRecord(geneticTree)) throw new Error('Invalid simulation snapshot: geneticTree is missing');
        requireFiniteFields(counters, 'counters', ['foodIdCounter', 'obstacleIdCounter', 'organismIdCounter', 'genomeIdCounter']);
        requireFiniteFields(stats, 'stats', ['totalDeaths', 'totalBirths', 'maxAge', 'maxGeneration']);
        requireConfig(state['config'], config);
        // Optional: snapshots written before the failsafe counters were recorded have none.
        if (state['failsafe'] !== undefined) requireFailsafe(state['failsafe']);
        requireWorldScale(state['worldScale'], liveScale);
        if (!isStringArray(geneticTree['roots'])) throw new Error('Invalid simulation snapshot: geneticTree.roots must be an array of strings');
        requireArray(geneticTree, 'nodes').forEach((node, i) => {
            if (!isGeneticTreeNode(node)) throw new Error(`Invalid genetic tree node at index ${String(i)}`);
        });

        requireArray(state, 'zones').forEach((z, i) => {
            if (!isRecord(z) || typeof z['id'] !== 'string' || !isVector(z['center']) || !isFiniteNumber(z['radius'])) {
                throw new Error(`Invalid zone at index ${String(i)}`);
            }
        });
        requireArray(state, 'obstacles').forEach((o, i) => {
            if (!isRecord(o) || typeof o['id'] !== 'string' || !isVector(o['position']) || !isFiniteNumber(o['radius'])) {
                throw new Error(`Invalid obstacle at index ${String(i)}`);
            }
        });
        requireArray(state, 'food').forEach((f, i) => {
            if (!isRecord(f) || typeof f['id'] !== 'string' || !isVector(f['position']) || !isFiniteNumber(f['currentEnergy'])) {
                throw new Error(`Invalid food at index ${String(i)}`);
            }
        });
        requireArray(state, 'organisms').forEach((o, i) => {
            const isValid = isRecord(o) && typeof o['id'] === 'string' && isVector(o['position'])
                && isVector(o['velocity']) && isVector(o['acceleration']) && isFiniteNumber(o['energy']);
            if (!isValid) throw new Error(`Invalid organism at index ${String(i)}`);
            requireGenome(o, i);
        });
    }

    // eslint-disable-next-line max-lines-per-function
    public static importState(engine: IPersistableEngine, state: SerializedSimulationStateV1): void {
        PersistenceService.assertImportable(state, engine.config, engine.getWorldScale());
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
                    zones: Map<string, EcologicalZone>;
                    gridManager: IPersistableEngine['gridManager'];
                    config: SimulationConfig;
                }) => void;
                getStats: () => SimulationStats;
                restoreHistoricalMaxima: (maxAge: number, maxGeneration: number) => void;
            };
        };

        const mutableEngine = engine as EngineMutableShape;
        const factory = engine.spawnService.getFactory();

        // Reset systems before loading state
        mutableEngine.seed = state.seed >>> 0;
        engine.random.reset(engine.seed);
        engine.random.setState(state.rngState >>> 0);
        mutableEngine.tick = state.tick;
        mutableEngine.foodIdCounter = state.counters.foodIdCounter;
        mutableEngine.obstacleIdCounter = state.counters.obstacleIdCounter;
        // Systems keep a reference to this object, so its values are replaced in place instead of the object itself.
        Object.assign(engine.config, state.config);
        engine.setFailsafeCounters(state.failsafe ?? { zeroPopulationTicks: 0, zeroFoodTicks: 0 });

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
        // The static grid still holds the obstacles of the previous world. Rebuild it from the imported ones.
        engine.gridManager.initializeStatic(engine.obstacles);

        const worldSize = PersistenceService.resolveWorldSize(engine);

        engine.food.clear();
        let droppedFood = 0;
        let legacyFood = 0;
        state.food.forEach(f => {
            if (PersistenceService.isFoodBlockedByAnomaly({
                position: f.position,
                zones: engine.zones.values(),
                obstacles: engine.obstacles.values(),
                worldSize,
            })) {
                droppedFood++;
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
            if (f.lastBiteTick === undefined) legacyFood++;
            food.lastBiteTick = f.lastBiteTick ?? Number.NEGATIVE_INFINITY;
            engine.food.set(f.id, food);
        });
        if (droppedFood > 0) {
            logger.warn('Snapshot food inside an obstacle or outside the world was dropped', 'Persistence', { count: droppedFood });
        }
        if (legacyFood > 0) {
            logger.warn('Snapshot has no food bite cooldown; restoring it as never bitten', 'Persistence', { count: legacyFood });
        }

        engine.organisms.clear();
        state.organisms.forEach(o => {
            const organism = new Organism(
                o.id as OrganismId,
                { ...o.position },
                o.genome as unknown as Genome,
                engine.random,
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
            organism.huntSuccessCount = o.huntSuccessCount;
            organism.causeOfDeath = o.causeOfDeath;
            organism.updateGrowthFromState();

            engine.organisms.set(o.id, organism);
        });

        engine.random.setState(state.rngState >>> 0);

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
        // Applied last: the maxima are cumulative, so the recorded values replace the ones derived from living organisms.
        mutableEngine.statisticsManager.restoreHistoricalMaxima(state.stats.maxAge, state.stats.maxGeneration);
    }
}
