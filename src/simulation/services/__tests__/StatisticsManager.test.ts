import { describe, expect, it } from 'vitest';

import { createWorldConfig } from '@/config';
import type { EcologicalZone } from '@/types';

import { type PopulationStatsAggregation,StatisticsManager } from '../StatisticsManager.manager';

const EMPTY_ZONES = new Map<string, EcologicalZone>();
const GRID_MANAGER_STUB = {
  getStats: () => ({ totalCells: 0, maxEntitiesInCell: 0, avgEntitiesPerCell: 0 }),
} as const;
const CONFIG_STUB = { foodSpawnRate: 0.5 } as const;
const FOOD_COUNT = 5;
const TICK = 10;
const PREY_COUNT = 2;
const PREDATOR_COUNT = 1;
const AVG_ENERGY = 30;
const AVG_PREY_ENERGY = 25;
const AVG_PREDATOR_ENERGY = 40;
const MAX_AGE = 12;
const MAX_GENERATION = 4;

describe('StatisticsManager aggregation', () => {
  it('builds population stats from a single aggregation payload', () => {
    const manager = new StatisticsManager(createWorldConfig(1));
    const aggregation: PopulationStatsAggregation = {
      preyCount: PREY_COUNT,
      predatorCount: PREDATOR_COUNT,
      totalEnergy: 90,
      preyEnergy: 50,
      predatorEnergy: 40,
      organismCount: 3,
      maxAge: MAX_AGE,
      maxGeneration: MAX_GENERATION,
    };

    manager.update({
      aggregation,
      foodSize: FOOD_COUNT,
      obstacleSize: 0,
      tick: TICK,
      zones: EMPTY_ZONES,
      gridManager: GRID_MANAGER_STUB as never,
      config: CONFIG_STUB as never,
    });

    const stats = manager.getStats();
    expect(stats.preyCount).toBe(PREY_COUNT);
    expect(stats.predatorCount).toBe(PREDATOR_COUNT);
    expect(stats.foodCount).toBe(FOOD_COUNT);
    expect(stats.avgEnergy).toBe(AVG_ENERGY);
    expect(stats.avgPreyEnergy).toBe(AVG_PREY_ENERGY);
    expect(stats.avgPredatorEnergy).toBe(AVG_PREDATOR_ENERGY);
    expect(stats.maxAge).toBe(MAX_AGE);
    expect(stats.maxGeneration).toBe(MAX_GENERATION);
  });
});
