/**
 * Entropia 3D — Simulation statistical data manager.
 *
 * Responsible for:
 * - Calculating integral population indicators.
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
import type { Organism } from '../Entity';
import type { GridManager } from '../managers/GridManager.manager';

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
 * The population figures of a set of organisms. Unlike the aggregation of a tick, it changes nothing in the organisms.
 */
export const aggregatePopulation = (organisms: Iterable<Organism>): PopulationStatsAggregation => {
    const aggregation: PopulationStatsAggregation = {
        preyCount: 0, predatorCount: 0, totalEnergy: 0, preyEnergy: 0, predatorEnergy: 0,
        organismCount: 0, maxAge: 0, maxGeneration: 0,
    };
    for (const org of organisms) {
        aggregation.organismCount++;
        aggregation.totalEnergy += org.energy;
        if (org.isPrey) {
            aggregation.preyCount++;
            aggregation.preyEnergy += org.energy;
        } else {
            aggregation.predatorCount++;
            aggregation.predatorEnergy += org.energy;
        }
        if (org.age > aggregation.maxAge) aggregation.maxAge = org.age;
        if (org.genome.generation > aggregation.maxGeneration) aggregation.maxGeneration = org.genome.generation;
    }
    return aggregation;
};

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
 * Manager for statistical calculations.
 */
export class StatisticsManager {
    private stats: SimulationStats = this.createEmptyStats();
    private cameraDataCache: CameraData | null = null;

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
     * Restores the cumulative maxima recorded in a snapshot. They never decrease, so they can exceed every living organism.
     */
    public restoreHistoricalMaxima(maxAge: number, maxGeneration: number): void {
        this.stats = { ...this.stats, maxAge, maxGeneration };
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
    }

    // ============================================================================
    // PRIVATE CALCULATION METHODS
    // ============================================================================

    /**
   * The averages and the extinction risk come from the aggregation of the current tick. They are recomputed on every tick,
   * so they are never older than the counts beside them, however fast the simulation runs.
   */
  private buildAggregatedStats(
    aggregation: PopulationStatsAggregation,
    foodSize: number
  ): Pick<SimulationStats, 'preyCount' | 'predatorCount' | 'foodCount' | 'avgEnergy' | 'avgPreyEnergy' | 'avgPredatorEnergy' | 'extinctionRisk' | 'maxAge' | 'maxGeneration'> {
    const avgEnergy = aggregation.organismCount > 0
      ? aggregation.totalEnergy / aggregation.organismCount
      : 0;
    const avgPreyEnergy = aggregation.preyCount > 0
      ? aggregation.preyEnergy / aggregation.preyCount
      : 0;
    const avgPredatorEnergy = aggregation.predatorCount > 0
      ? aggregation.predatorEnergy / aggregation.predatorCount
      : 0;

    return {
      preyCount: aggregation.preyCount,
      predatorCount: aggregation.predatorCount,
      foodCount: foodSize,
      avgEnergy,
      avgPreyEnergy,
      avgPredatorEnergy,
      extinctionRisk: this.calculateExtinctionRisk(aggregation),
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
