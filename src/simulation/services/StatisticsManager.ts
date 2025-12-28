/**
 * Entropia 3D — Менеджер статистичних даних симуляції.
 *
 * Відповідає за:
 * - Обчислення та кешування інтегральних показників популяції.
 * - Розрахунок ризику вимирання.
 * - Агрегацію метрик продуктивності просторової сітки.
 * - Управління даними камери для діагностики.
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
import type { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Структура кешованих статистичних даних.
 */
interface StatsCache {
    avgEnergy: number;
    avgPreyEnergy: number;
    avgPredatorEnergy: number;
    extinctionRisk: number;
    lastUpdate: number;
    cacheTimeout: number;
}

/**
 * Дані камери для діагностики.
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
 * Менеджер статистичних обчислень та кешування.
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
     * Створення порожньої структури статистики.
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
     * Отримання поточної статистики.
     */
    public getStats(): SimulationStats {
        return this.stats;
    }

    /**
     * Повне оновлення статистики на основі стану симуляції.
     */
    public update(
        organisms: Map<string, Organism>,
        foodSize: number,
        obstacleSize: number,
        tick: number,
        zones: Map<string, EcologicalZone>,
        spatialGrid: SpatialHashGrid,
        config: SimulationConfig
    ): void {
        const baseStats = this.calculateBasicPopStats(organisms, foodSize);
        const maxStats = this.calculateMaxStats(organisms);
        const cachedStats = this.getOrUpdateCachedStats(organisms);

        const newStats: SimulationStats = {
            ...baseStats,
            ...maxStats,
            ...cachedStats,
            generation: tick,
            totalDeaths: this.stats.totalDeaths,
            totalBirths: this.stats.totalBirths,
        };

        if (this.hasStatsChanged(newStats)) {
            this.stats = newStats;
        }

        this.updateWorldGeometry(tick, zones, spatialGrid, config, obstacleSize);
    }

    /**
     * Інкрементація лічильника смертей.
     */
    public incrementDeaths(count: number = 1): void {
        this.stats = { ...this.stats, totalDeaths: this.stats.totalDeaths + count };
    }

    /**
     * Інкрементація лічильника народжень.
     */
    public incrementBirths(count: number = 1): void {
        this.stats = { ...this.stats, totalBirths: this.stats.totalBirths + count };
    }

    /**
     * Встановлення даних камери.
     */
    public setCameraData(cameraData: CameraData): void {
        this.cameraDataCache = cameraData;
        this.updateCameraStats(cameraData);
    }

    /**
     * Скидання статистики.
     */
    public reset(): void {
        this.stats = this.createEmptyStats();
        this.cameraDataCache = null;
        this.statsCache.lastUpdate = 0;
    }

    // ============================================================================
    // ПРИВАТНІ МЕТОДИ ОБЧИСЛЕННЯ
    // ============================================================================

    private shouldUpdateCache(): boolean {
        return Date.now() - this.statsCache.lastUpdate > this.statsCache.cacheTimeout;
    }

    private calculateBasicPopStats(
        organisms: Map<string, Organism>,
        foodSize: number
    ): Pick<SimulationStats, 'preyCount' | 'predatorCount' | 'foodCount'> {
        let preyCount = 0;
        let predatorCount = 0;

        organisms.forEach(org => {
            if (org.type === 'PREY') {
                preyCount++;
            } else {
                predatorCount++;
            }
        });

        return { preyCount, predatorCount, foodCount: foodSize };
    }

    private calculateMaxStats(
        organisms: Map<string, Organism>
    ): Pick<SimulationStats, 'maxAge' | 'maxGeneration'> {
        let maxAge = this.stats.maxAge;
        let maxGeneration = this.stats.maxGeneration;

        organisms.forEach(org => {
            if (org.age > maxAge) {
                maxAge = org.age;
            }
            if (org.genome.generation > maxGeneration) {
                maxGeneration = org.genome.generation;
            }
        });

        return { maxAge, maxGeneration };
    }

    private getOrUpdateCachedStats(
        organisms: Map<string, Organism>
    ): Pick<SimulationStats, 'avgEnergy' | 'avgPreyEnergy' | 'avgPredatorEnergy' | 'extinctionRisk'> {
        if (!this.shouldUpdateCache()) {
            return {
                avgEnergy: this.statsCache.avgEnergy,
                avgPreyEnergy: this.statsCache.avgPreyEnergy,
                avgPredatorEnergy: this.statsCache.avgPredatorEnergy,
                extinctionRisk: this.statsCache.extinctionRisk,
            };
        }

        const avgEnergy = this.calculateAverageEnergy(organisms);
        const avgPreyEnergy = this.calculateAverageEnergyByType(organisms, 'PREY');
        const avgPredatorEnergy = this.calculateAverageEnergyByType(organisms, 'PREDATOR');
        const extinctionRisk = this.calculateExtinctionRisk(organisms);

        this.statsCache.avgEnergy = avgEnergy;
        this.statsCache.avgPreyEnergy = avgPreyEnergy;
        this.statsCache.avgPredatorEnergy = avgPredatorEnergy;
        this.statsCache.extinctionRisk = extinctionRisk;
        this.statsCache.lastUpdate = Date.now();

        return { avgEnergy, avgPreyEnergy, avgPredatorEnergy, extinctionRisk };
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

    private calculateAverageEnergy(organisms: Map<string, Organism>): number {
        if (organisms.size === 0) { return 0; }
        let total = 0;
        organisms.forEach(org => { total += org.energy; });
        return total / organisms.size;
    }

    private calculateAverageEnergyByType(
        organisms: Map<string, Organism>,
        type: 'PREY' | 'PREDATOR'
    ): number {
        let total = 0;
        let count = 0;
        organisms.forEach(org => {
            if (org.type === type) {
                total += org.energy;
                count++;
            }
        });
        return count > 0 ? total / count : 0;
    }

    private calculateExtinctionRisk(organisms: Map<string, Organism>): number {
        let preyCount = 0;
        let predatorCount = 0;

        organisms.forEach(org => {
            if (org.type === 'PREY') { preyCount++; }
            else { predatorCount++; }
        });

        const totalCount = preyCount + predatorCount;
        if (totalCount === 0) { return 1; }

        const preyRatio = preyCount / Math.max(1, totalCount);
        const predRatio = predatorCount / Math.max(1, totalCount);

        let risk = 0;
        if (preyCount < STATS_CONSTANTS.EXTINCTION_THRESHOLD_LOW) {
            risk = Math.max(risk, STATS_CONSTANTS.EXTINCTION_RISK_HIGH);
        } else if (preyCount < STATS_CONSTANTS.EXTINCTION_THRESHOLD_LOW * 2) {
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
    // МЕТОДИ ОНОВЛЕННЯ ГЕОМЕТРИЧНИХ ДАНИХ
    // ============================================================================

    private updateWorldGeometry(
        tick: number,
        zones: Map<string, EcologicalZone>,
        spatialGrid: SpatialHashGrid,
        config: SimulationConfig,
        obstacleSize: number
    ): void {
        this.stats = {
            ...this.stats,
            worldSize: this.worldConfig.WORLD_SIZE,
            foodSpawnRate: config.foodSpawnRate || 0,
            obstacleCount: obstacleSize,
            worldAge: Math.floor(tick / STATS_CONSTANTS.WORLD_AGE_FALLBACK_TPS),
        };

        this.updateCameraStats(this.cameraDataCache ?? undefined);
        this.updateZoneStats(zones);
        this.updateGridStats(spatialGrid);
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
            targetX: this.worldConfig.WORLD_SIZE / 2,
            targetY: this.worldConfig.WORLD_SIZE / 2,
            targetZ: this.worldConfig.WORLD_SIZE / 2,
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
        let sanctuary = 0;

        zones.forEach(z => {
            switch (z.type) {
                case ZoneType.OASIS: oasis++; break;
                case ZoneType.DESERT: desert++; break;
                case ZoneType.HUNTING_GROUND: hunting++; break;
                case ZoneType.SANCTUARY: sanctuary++; break;
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

    private updateGridStats(spatialGrid: SpatialHashGrid): void {
        const gridStats = spatialGrid.getStats();

        this.stats = {
            ...this.stats,
            cellSize: STATS_CONSTANTS.MAX_CELL_SIZE,
            occupiedCells: gridStats.totalCells,
            totalCells: Math.pow(
                Math.ceil(this.worldConfig.WORLD_SIZE / STATS_CONSTANTS.MAX_CELL_SIZE),
                3
            ),
            maxDensity: gridStats.maxEntitiesInCell,
            gridEfficiency: gridStats.avgEntitiesPerCell,
        };
    }
}
