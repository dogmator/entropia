/**
 * Entropia 3D — Сервіс збереження та завантаження стану симуляції.
 *
 * Відповідає за серіалізацію та десеріалізацію всього світу Entropia,
 * включаючи організми, генеалогічне дерево, об'єкти середовища та статистику.
 */

import type {
    GeneticTreeNode,
    SerializedEcologicalZone,
    SerializedFood,
    SerializedGeneticTreeNode,
    SerializedGenome,
    SerializedObstacle,
    SerializedOrganism,
    SerializedSimulationStateV1,
    SimulationConfig,
} from '@/types';
import {
    createFoodId,
    createGenomeId,
    createObstacleId,
    createOrganismId} from '@/types';

import { Random } from '@/core';
import { Food, Obstacle, Organism } from '../Entity';

export class PersistenceService {
    /**
     * Експортує поточний стан симуляції у серіалізований формат (V1).
     */
    public static exportState(engine: any): SerializedSimulationStateV1 {
        const geneticNodes: SerializedGeneticTreeNode[] = [];
        engine.geneticTree.forEach((node: GeneticTreeNode) => {
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

        const zones: SerializedEcologicalZone[] = Array.from(engine.zones.values()).map((z: any) => ({
            id: z.id,
            type: z.type,
            center: engine.mapVector3(z.center),
            radius: z.radius,
            foodMultiplier: z.foodMultiplier,
            dangerMultiplier: z.dangerMultiplier,
        }));

        const obstacles: SerializedObstacle[] = Array.from(engine.obstacles.values()).map((o: any) => ({
            id: String(o.id),
            position: engine.mapVector3(o.position),
            radius: o.radius,
            color: o.color,
            opacity: o.opacity,
            isWireframe: o.isWireframe,
        }));

        const food: SerializedFood[] = Array.from(engine.food.values()).map((f: any) => ({
            id: String(f.id),
            position: engine.mapVector3(f.position),
            radius: f.radius,
            energyValue: f.energyValue,
            spawnTime: f.spawnTime,
            consumed: f.consumed,
        }));

        const organisms: SerializedOrganism[] = Array.from(engine.organisms.values()).map((o: any) => {
            const genome: SerializedGenome = {
                ...(o.genome as unknown as SerializedGenome),
                id: String(o.genome.id),
                parentId: o.genome.parentId ? String(o.genome.parentId) : null,
            };

            return {
                id: String(o.id),
                type: o.type,
                position: engine.mapVector3(o.position),
                velocity: engine.mapVector3(o.velocity),
                acceleration: engine.mapVector3(o.acceleration),
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

        const factory = engine.spawnService.getFactory();

        return {
            version: 1,
            seed: engine.seed,
            rngState: engine.rng.getState(),
            tick: engine.tick,
            counters: {
                foodIdCounter: engine.foodIdCounter,
                obstacleIdCounter: engine.obstacleIdCounter,
                organismIdCounter: factory.getIdCounter(),
                genomeIdCounter: factory.getGenomeIdCounter(),
            },
            stats: {
                totalDeaths: engine.stats.totalDeaths,
                totalBirths: engine.stats.totalBirths,
                maxAge: engine.stats.maxAge,
                maxGeneration: engine.stats.maxGeneration,
            },
            config: { ...(engine.config as unknown as SimulationConfig) },
            zones,
            obstacles,
            food,
            organisms,
            geneticTree: {
                roots: engine.geneticRoots.map(String),
                nodes: geneticNodes,
            },
        };
    }

    /**
     * Імпортує стан симуляції, відновлюючи всі структури даних.
     */
    public static importState(engine: any, state: SerializedSimulationStateV1): void {
        if (state.version !== 1) {
            throw new Error(`Непідтримувана версія стану симуляції: ${String((state as any).version)}`);
        }

        engine.eventBus.clearHistory();
        engine.organisms.clear();
        engine.food.clear();
        engine.obstacles.clear();
        engine.zones.clear();
        engine.geneticTree.clear();
        engine.geneticRoots.length = 0;
        engine.spatialGrid.clear();

        engine.seed = state.seed >>> 0;
        engine.rng.reset(engine.seed);
        engine.tick = state.tick;
        engine.foodIdCounter = state.counters.foodIdCounter;
        engine.obstacleIdCounter = state.counters.obstacleIdCounter;

        Object.assign(engine.config, state.config);

        // Відновлення колекцій
        this.restoreCollection(state.zones, engine.zones, z => ({
            id: z.id,
            type: z.type,
            center: engine.mapVector3(z.center),
            radius: z.radius,
            foodMultiplier: z.foodMultiplier,
            dangerMultiplier: z.dangerMultiplier,
        }));

        this.restoreCollection(state.obstacles, engine.obstacles, o => new Obstacle(
            createObstacleId(o.id),
            engine.mapVector3(o.position),
            o.radius,
            o.color,
            o.opacity,
            o.isWireframe
        ));

        this.restoreCollection(state.food, engine.food, f => {
            const food = new Food(
                createFoodId(f.id),
                engine.mapVector3(f.position),
                f.energyValue,
                f.spawnTime
            );
            food.consumed = f.consumed;
            food.radius = f.radius;
            return food;
        });

        const tmpRng = new Random(0);
        this.restoreCollection(state.organisms, engine.organisms, (o: SerializedOrganism) => {
            const genome = {
                ...o.genome,
                id: createGenomeId(o.genome.id),
                parentId: o.genome.parentId ? createGenomeId(o.genome.parentId) : null,
            };

            const organism = new Organism(
                createOrganismId(o.id),
                engine.mapVector3(o.position),
                genome as any,
                o.parentOrganismId ? createOrganismId(o.parentOrganismId) : null,
                tmpRng
            );

            organism.velocity = engine.mapVector3(o.velocity);
            organism.acceleration = engine.mapVector3(o.acceleration);
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

        // Відновлення генеалогічного дерева
        for (const root of state.geneticTree.roots) {
            engine.geneticRoots.push(createGenomeId(root));
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
            engine.geneticTree.set(node.id, node);
        }

        // Початкове оновлення статистики
        engine.updateStats();
    }

    /**
     * Допоміжний метод для відновлення Map-колекцій.
     */
    private static restoreCollection<S, T>(
        source: S[],
        target: Map<any, T>,
        mapper: (s: S) => T
    ): void {
        for (const item of source) {
            const entity = mapper(item);
            const id = (entity as any).id;
            if (id !== undefined) {
                target.set(id, entity);
            }
        }
    }
}
