import type { RandomStream } from '@/core/utils/Random.utils';
import type {
    EcologicalZone,
    FailsafeCounters,
    GeneticTreeNode,
} from '@/types';
import type {
    GenomeId,
    SimulationConfig,
    SimulationStats,
    Vector3,
} from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import type { ResourceStock } from '../services/ResourceStock.service';

export interface IPersistableEngine {
    readonly seed: number;
    readonly random: RandomStream;
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
    readonly resourceStock: ResourceStock;

    getStats(): SimulationStats;
    getFailsafeCounters(): FailsafeCounters;
    setFailsafeCounters(counters: FailsafeCounters): void;
    getWorldScale(): number;
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
        initializeStatic(obstacles: Map<string, Obstacle>): void;
    };
}
