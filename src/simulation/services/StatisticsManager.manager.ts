/**
 * Entropia 3D — Simulation statistical data manager.
 *
 * Responsible for:
 * - Calculating and caching integral population indicators.
 * - Calculating extinction risk.
 * - Aggregating spatial grid performance metrics.
 * - Managing camera data for diagnostics.
 */

import type {
    EcologicalZone,
    SimulationConfig,
    SimulationStats,
    WorldConfig,
} from '@/types';
import { ZoneType } from '@/types';

import { STATS_CONSTANTS } from '../../config';
import type { GridManager } from '../managers/GridManager.manager';

/**
 * Cached statistical data structure.
 */
interface StatsCache {
    avgEnergy: number;
    avgPreyEnergy: number;
    avgPredatorEnergy: number;
    extinctionRisk: number;
    lastUpdate: number;
    cacheTimeout: number;
}

export interface PopulationStatsAggregation {
    preyCount: number;
    predatorCount: number;
    totalEnergy: number;
    preyEnergy: number;
    predatorEnergy: number;
    organismCount: number;
    maxAge: number;
    maxGeneration: number;
}

interface StatisticsUpdateParams {
    aggregation: PopulationStatsAggregation;
    foodSize: number;
    obstacleSize: number;
    tick: number;
    zones: Map<string, EcologicalZone>;
    gridManager: GridManager;
    config: SimulationConfig;
}

interface WorldGeometryUpdateParams {
    tick: number;
    zones: Map<string, EcologicalZone>;
    gridManager: GridManager;
    config: SimulationConfig;
    obstacleSize: number;
}

const EXTINCTION_WARNING_MULTIPLIER = 2;
const WORLD_CENTER_DIVISOR = 2;
const TOTAL_GRID_DIMENSIONS = 3;

/**
 * Camera data for diagnostics.
 */
export interface CameraData {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
    distance: number;
    fov: number;
    aspect: number;
    near: number;
    far: number;
}

/**
 * Manager for statistical calculations and caching.
 */
export class StatisticsManager {
    private stats: SimulationStats = this.createEmptyStats();
    private cameraDataCache: CameraData | null = null;

    private readonly statsCache: StatsCache = {
        avgEnergy: 0,
        avgPreyEnergy: 0,
        avgPredatorEnergy: 0,
        extinctionRisk: 0,
        lastUpdate: 0,
        cacheTimeout: STATS_CONSTANTS.CACHE_TIMEOUT,
    };

    constructor(
        private readonly worldConfig: WorldConfig
    ) { }

    /**
     * Creating an empty statistics structure.
     */
    private createEmptyStats(): SimulationStats {
        return {
            preyCount: 0,
            predatorCount: 0,
            foodCount: 0,
            avgEnergy: 0,
            avgPreyEnergy: 0,
            avgPredatorEnergy: 0,
            generation: 0,
            maxGeneration: 1,
            maxAge: 0,
            totalDeaths: 0,
            totalBirths: 0,
            extinctionRisk: 0,
        };
    }

    /**
     * Getting current statistics.
     */
    public getStats(): SimulationStats {
        return this.stats;
    }

    /**
     * Full update of statistics based on simulation state.
     */
    public update(params: StatisticsUpdateParams): void {
        const {
            aggregation,
            foodSize,
            obstacleSize,
            tick,
            zones,
            gridManager,
            config,
        } = params;
        const aggregatedStats = this.buildAggregatedStats(aggregation, foodSize);

        const newStats: SimulationStats = {
            ...aggregatedStats,
            generation: tick,
            totalDeaths: this.stats.totalDeaths,
            totalBirths: this.stats.totalBirths,
        };

        if (this.hasStatsChanged(newStats)) {
            this.stats = newStats;
        }

        this.updateWorldGeometry({
            tick,
            zones,
            gridManager,
            config,
            obstacleSize,
        });
    }

    /**
     * Increment death counter.
     */
    public incrementDeaths(count = 1): void {
        this.stats = { ...this.stats, totalDeaths: this.stats.totalDeaths + count };
    }

    /**
     * Increment birth counter.
     */
    public incrementBirths(count = 1): void {
        this.stats = { ...this.stats, totalBirths: this.stats.totalBirths + count };
    }

    /**
     * Set camera data.
     */
    public setCameraData(cameraData: CameraData): void {
        this.cameraDataCache = cameraData;
        this.updateCameraStats(cameraData);
    }

    /**
     * Reset statistics.
     */
    public reset(): void {
        this.stats = this.createEmptyStats();
        this.cameraDataCache = null;
        this.statsCache.lastUpdate = 0;
    }

    // ============================================================================
    // PRIVATE CALCULATION METHODS
    // ============================================================================

    private shouldUpdateCache(): boolean {
        return Date.now() - this.statsCache.lastUpdate > this.statsCache.cacheTimeout;
    }

    private buildAggregatedStats(
        aggregation: PopulationStatsAggregation,
        foodSize: number
    ): Pick<SimulationStats, 'preyCount' | 'predatorCount' | 'foodCount' | 'avgEnergy' | 'avgPreyEnergy' | 'avgPredatorEnergy' | 'extinctionRisk' | 'maxAge' | 'maxGeneration'> {
        if (!this.shouldUpdateCache()) {
            return {
                preyCount: aggregation.preyCount,
                predatorCount: aggregation.predatorCount,
                foodCount: foodSize,
                avgEnergy: this.statsCache.avgEnergy,
                avgPreyEnergy: this.statsCache.avgPreyEnergy,
                avgPredatorEnergy: this.statsCache.avgPredatorEnergy,
                extinctionRisk: this.statsCache.extinctionRisk,
                maxAge: Math.max(this.stats.maxAge, aggregation.maxAge),
                maxGeneration: Math.max(this.stats.maxGeneration, aggregation.maxGeneration),
            };
        }

        const avgEnergy = aggregation.organismCount > 0
            ? aggregation.totalEnergy / aggregation.organismCount
            : 0;
        const avgPreyEnergy = aggregation.preyCount > 0
            ? aggregation.preyEnergy / aggregation.preyCount
            : 0;
        const avgPredatorEnergy = aggregation.predatorCount > 0
            ? aggregation.predatorEnergy / aggregation.predatorCount
            : 0;
        const extinctionRisk = this.calculateExtinctionRisk(aggregation);

        this.statsCache.avgEnergy = avgEnergy;
        this.statsCache.avgPreyEnergy = avgPreyEnergy;
        this.statsCache.avgPredatorEnergy = avgPredatorEnergy;
        this.statsCache.extinctionRisk = extinctionRisk;
        this.statsCache.lastUpdate = Date.now();

        return {
            preyCount: aggregation.preyCount,
            predatorCount: aggregation.predatorCount,
            foodCount: foodSize,
            avgEnergy,
            avgPreyEnergy,
            avgPredatorEnergy,
            extinctionRisk,
            maxAge: Math.max(this.stats.maxAge, aggregation.maxAge),
            maxGeneration: Math.max(this.stats.maxGeneration, aggregation.maxGeneration),
        };
    }

    private hasStatsChanged(newStats: SimulationStats): boolean {
        return (
            this.stats.preyCount !== newStats.preyCount ||
            this.stats.predatorCount !== newStats.predatorCount ||
            this.stats.foodCount !== newStats.foodCount ||
            this.stats.avgEnergy !== newStats.avgEnergy ||
            this.stats.extinctionRisk !== newStats.extinctionRisk ||
            this.stats.generation !== newStats.generation ||
            this.stats.maxAge !== newStats.maxAge
        );
    }

    private calculateExtinctionRisk(aggregation: PopulationStatsAggregation): number {
        const { preyCount, predatorCount } = aggregation;
        const totalCount = preyCount + predatorCount;
        if (totalCount === 0) { return 1; }

        const preyRatio = preyCount / Math.max(1, totalCount);
        const predRatio = predatorCount / Math.max(1, totalCount);

        let risk = 0;
        if (preyCount < STATS_CONSTANTS.EXTINCTION_THRESHOLD_LOW) {
            risk = Math.max(risk, STATS_CONSTANTS.EXTINCTION_RISK_HIGH);
        } else if (preyCount < STATS_CONSTANTS.EXTINCTION_THRESHOLD_LOW * EXTINCTION_WARNING_MULTIPLIER) {
            risk = Math.max(risk, STATS_CONSTANTS.EXTINCTION_RISK_MEDIUM);
        }

        if (predatorCount < STATS_CONSTANTS.EXTINCTION_THRESHOLD_LOW) {
            risk = Math.max(risk, STATS_CONSTANTS.EXTINCTION_RISK_HIGH);
        }

        const imbalance = Math.abs(preyRatio - predRatio);
        risk = Math.max(risk, imbalance * STATS_CONSTANTS.RISK_FACTOR_OFFSET);

        return Math.min(1, risk);
    }

    // ============================================================================
    // WORLD GEOMETRY UPDATE METHODS
    // ============================================================================

    private updateWorldGeometry(params: WorldGeometryUpdateParams): void {
        const {
            tick,
            zones,
            gridManager,
            config,
            obstacleSize,
        } = params;
        this.stats = {
            ...this.stats,
            worldSize: this.worldConfig.WORLD_SIZE,
            foodSpawnRate: config.foodSpawnRate,
            obstacleCount: obstacleSize,
            worldAge: Math.floor(tick / STATS_CONSTANTS.WORLD_AGE_FALLBACK_TPS),
        };

        this.updateCameraStats(this.cameraDataCache ?? undefined);
        this.updateZoneStats(zones);
        this.updateGridStats(gridManager);
    }

    private updateCameraStats(cameraData?: CameraData): void {
        if (cameraData) {
            this.stats = {
                ...this.stats,
                cameraX: cameraData.position.x,
                cameraY: cameraData.position.y,
                cameraZ: cameraData.position.z,
                targetX: cameraData.target.x,
                targetY: cameraData.target.y,
                targetZ: cameraData.target.z,
                zoom: cameraData.zoom,
                cameraDistance: cameraData.distance,
                cameraFov: cameraData.fov,
                cameraAspect: cameraData.aspect,
            };
        } else {
            this.resetCameraStats();
        }
    }

    private resetCameraStats(): void {
        this.stats = {
            ...this.stats,
            cameraX: 0,
            cameraY: 0,
            cameraZ: 0,
            targetX: this.worldConfig.WORLD_SIZE / WORLD_CENTER_DIVISOR,
            targetY: this.worldConfig.WORLD_SIZE / WORLD_CENTER_DIVISOR,
            targetZ: this.worldConfig.WORLD_SIZE / WORLD_CENTER_DIVISOR,
            zoom: STATS_CONSTANTS.DEFAULT_ZOOM,
            cameraDistance: 0,
            cameraFov: STATS_CONSTANTS.DEFAULT_CAMERA_FOV,
            cameraAspect: 1,
        };
    }

    private updateZoneStats(zones: Map<string, EcologicalZone>): void {
        let oasis = 0;
        let desert = 0;
        let hunting = 0;

        zones.forEach(z => {
            switch (z.type) {
                case ZoneType.OASIS: oasis++; break;
                case ZoneType.DESERT: desert++; break;
                case ZoneType.HUNTING_GROUND: hunting++; break;
                case ZoneType.SANCTUARY: break;
            }
        });

        this.stats = {
            ...this.stats,
            growthZones: oasis,
            neutralZones: desert,
            dangerZones: hunting,
            totalZones: zones.size,
            activeZones: zones.size,
        };
    }

    private updateGridStats(gridManager: GridManager): void {
        const gridStats = gridManager.getStats();

        this.stats = {
            ...this.stats,
            cellSize: STATS_CONSTANTS.MAX_CELL_SIZE,
            occupiedCells: gridStats.totalCells,
            totalCells: Math.pow(
                Math.ceil(this.worldConfig.WORLD_SIZE / STATS_CONSTANTS.MAX_CELL_SIZE),
                TOTAL_GRID_DIMENSIONS
            ),
            maxDensity: gridStats.maxEntitiesInCell,
            gridEfficiency: gridStats.avgEntitiesPerCell,
        };
    }
}
