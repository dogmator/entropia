import { Random } from '@/core/utils/Random';
import {
    createFoodId,
    createObstacleId,
} from '@/types';
import type {
    GeneticTreeNode,
    Genome,
    GenomeId,
    OrganismId,
    SerializedGenome,
    SerializedSimulationStateV1,
} from '@/types';
import { isPreyGenome, isPredatorGenome } from '@/types';
import { Food, Obstacle, Organism } from '../Entity';
import { IPersistableEngine } from '../interfaces/IPersistableEngine';

export class PersistenceService {
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
                energyValue: f.energyValue,
                spawnTime: f.spawnTime,
                consumed: f.consumed,
            })),
            organisms: Array.from(engine.organisms.values()).map(o => ({
                id: o.id,
                type: o.type as 'PREY' | 'PREDATOR',
                position: engine.mapVector3(o.position),
                velocity: engine.mapVector3(o.velocity),
                acceleration: engine.mapVector3(o.acceleration),
                radius: o.radius,
                energy: o.energy,
                age: o.age,
                state: o.state,
                isDead: o.isDead,
                causeOfDeath: (o as any).causeOfDeath || null,
                trailEnabled: o.trailEnabled,
                parentOrganismId: o.parentOrganismId,
                huntSuccessCount: (o as any).huntSuccessCount || 0,
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
            })),
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

    public static importState(engine: IPersistableEngine, state: SerializedSimulationStateV1): void {
        const factory = engine.spawnService.getFactory();

        // Скидання систем перед завантаженням стану
        (engine as { seed: number }).seed = state.seed >>> 0;
        Random.reset(engine.seed);
        (engine as { tick: number }).tick = state.tick;
        (engine as { foodIdCounter: number }).foodIdCounter = state.counters.foodIdCounter;
        (engine as { obstacleIdCounter: number }).obstacleIdCounter = state.counters.obstacleIdCounter;

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

        engine.food.clear();
        state.food.forEach(f => {
            const food = new Food(
                createFoodId(f.id),
                { ...f.position },
                f.energyValue,
                f.spawnTime
            );
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

            engine.organisms.set(o.id, organism);
        });
    }
}
