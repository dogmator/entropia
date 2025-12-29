/**
 * Statistics and diagnostic constants.
 */
export const STATS_CONSTANTS = {
    MS_PER_SECOND: 1000,
    CACHE_TIMEOUT: 1000,
    DEFAULT_CAMERA_FOV: 60,
    DEFAULT_ZOOM: 1,
    WORLD_AGE_FALLBACK_TPS: 60,
    EXTINCTION_THRESHOLD_LOW: 5,
    EXTINCTION_RISK_HIGH: 0.9,
    EXTINCTION_RISK_MEDIUM: 0.5,
    RISK_FACTOR_OFFSET: 0.1,
    MAX_CELL_SIZE: 80,
    GRID_FALLBACK_MULT: 2,
} as const;

const INIT = {
    COUNT: 0,
    ENERGY: 0,
    GENERATION: 0,
    RISK: 0,
    FPS: 60,
    METRIC: 0,
} as const;

export const INITIAL_SIMULATION_STATS = {
    preyCount: INIT.COUNT,
    predatorCount: INIT.COUNT,
    foodCount: INIT.COUNT,
    avgEnergy: INIT.ENERGY,
    avgPreyEnergy: INIT.ENERGY,
    avgPredatorEnergy: INIT.ENERGY,
    generation: INIT.GENERATION,
    maxGeneration: INIT.GENERATION,
    maxAge: INIT.GENERATION,
    totalDeaths: INIT.COUNT,
    totalBirths: INIT.COUNT,
    extinctionRisk: INIT.RISK,
    performance: {
        fps: INIT.FPS,
        tps: INIT.FPS,
        frameTime: INIT.METRIC,
        simulationTime: INIT.METRIC,
        entityCount: INIT.COUNT,
        drawCalls: INIT.COUNT,
    }
} as const;
