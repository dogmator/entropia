import { logger } from '@/core';
import type { EcologicalZone, WorldConfig } from '@/types';

import type { Food, Obstacle } from '../Entity';
import { FOOD_ANOMALY_PADDING, foodForbiddingZones, isPositionBlockedByAnomalies } from '../utils/AnomalyValidation';

interface SanitizeParams {
    food: Map<string, Food>;
    obstacles: IterableIterator<Obstacle>;
    zones: IterableIterator<EcologicalZone>;
    tick: number;
}

export class FoodAnomalyGuard {
    /** Energy of food removed for lying in an anomaly. Read by the resource ledger; not part of a snapshot. */
    public energyRemoved = 0;
    private needsSanitization = true;

    constructor(private readonly worldConfig: WorldConfig) {}

    public sanitizeIfNeeded(params: SanitizeParams): void {
        const { food, obstacles, zones, tick } = params;
        if (!this.needsSanitization) return;

        const obstacleArr = Array.from(obstacles);
        const zoneArr = Array.from(zones);
        let removed = 0;

        for (const [foodId, foodItem] of food.entries()) {
            if (isPositionBlockedByAnomalies({
                position: foodItem.position,
                obstacles: obstacleArr.values(),
                zones: foodForbiddingZones(zoneArr),
                worldSize: this.worldConfig.WORLD_SIZE,
                obstaclePadding: FOOD_ANOMALY_PADDING,
                zonePadding: FOOD_ANOMALY_PADDING,
                checkZones: true,
            })) {
                this.energyRemoved += foodItem.currentEnergy;
                food.delete(foodId);
                removed++;
            }
        }

        this.needsSanitization = false;

        if (removed > 0) {
            logger.warn('Runtime food anomaly sanitation removed invalid food items', 'Engine', {
                tick,
                removedFood: removed,
            });
        }
    }

    public reset(): void {
        this.needsSanitization = true;
    }
}
