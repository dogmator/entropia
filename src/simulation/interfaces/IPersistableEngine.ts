import {
    GenomeId,
    SimulationConfig,
    SimulationStats,
    Vector3,
} from '@/types';
import type {
    EcologicalZone,
    GeneticTreeNode,
} from '@/types';
import type { Food, Obstacle, Organism } from '../Entity';

export interface IPersistableEngine {
    readonly seed: number;
    readonly tick: number;
    readonly config: SimulationConfig;
    readonly foodIdCounter: number;
    readonly obstacleIdCounter: number;
    readonly geneticRoots: GenomeId[];

    readonly zones: Map<string, EcologicalZone>;
    readonly obstacles: Map<string, Obstacle>;
    readonly food: Map<string, Food>;
    readonly organisms: Map<string, Organism>;
    readonly geneticTree: Map<GenomeId, GeneticTreeNode>;

    getStats(): SimulationStats;
    mapVector3(v: Vector3): { x: number; y: number; z: number };

    readonly spawnService: {
        getFactory(): {
            getIdCounter(): number;
            getGenomeIdCounter(): number;
            setIdCounter(val: number): void;
            setGenomeIdCounter(val: number): void;
        };
    };

    readonly eventBus: {
        clearHistory(): void;
    };

    readonly gridManager: {
        clear(): void;
    };
}
