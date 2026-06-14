import type { SerializedSimulationStateV1, SimulationConfig } from '@/types';

export const FALLBACK_SIMULATION_CONFIG: SimulationConfig = {
    foodSpawnRate: 0,
    maxFood: 0,
    maxOrganisms: 0,
    showObstacles: true,
    mutationFactor: 0,
    reproductionThreshold: 0,
    organismOpacity: 1,
    foodOpacity: 1,
    organismScale: 1,
    foodScale: 1,
    bloomIntensity: 0,
    showGrid: false,
    gridOpacity: 0,
    trailLength: 0,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    graphicsQuality: 'CUSTOM',
    drag: 1,
    separationWeight: 0,
    alignmentWeight: 0,
    cohesionWeight: 0,
    seekWeight: 0,
    avoidWeight: 0,
};

/**
 * Builds a fallback state for export when the actual state is not available.
 */
export function buildFallbackExportState(config?: SimulationConfig): SerializedSimulationStateV1 {
    return {
        version: 1, seed: 0, rngState: 0, tick: 0,
        counters: { foodIdCounter: 0, obstacleIdCounter: 0, organismIdCounter: 0, genomeIdCounter: 0 },
        stats: { totalDeaths: 0, totalBirths: 0, maxAge: 0, maxGeneration: 0 },
        config: config ?? FALLBACK_SIMULATION_CONFIG,
        zones: [], obstacles: [], food: [], organisms: [],
        geneticTree: { roots: [], nodes: [] },
    };
}
