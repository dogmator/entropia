/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { EventBus } from '@/core';
import { RandomStream } from '@/core/utils/Random.utils';
import type { Obstacle } from '@/simulation/Entity';
import { GridManager } from '@/simulation/managers/GridManager.manager';
import { FoodSpawnStrategy, SpawnService } from '@/simulation/services/Spawn.service';
import { type EcologicalZone, ZoneType } from '@/types';

const WORLD_SIZE = 100;
const OASIS_CENTER = { x: 50, y: 50, z: 50 };
const OASIS_RADIUS = 20;
const SPAWN_ATTEMPTS = 400;
const FOOD_MIN_OBSTACLE_DISTANCE = 5;
const SEED = 7;

const WORLD_CONFIG = {
  WORLD_SIZE,
  MAX_TOTAL_ORGANISMS: 100,
  INITIAL_PREY: 0,
  INITIAL_PREDATOR: 0,
  MAX_FOOD: 400,
  FOOD_SPAWN_RATE: 0.1,
};

const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const oasisZones = (): Map<string, EcologicalZone> => new Map([[
  'oasis_center',
  {
    id: 'oasis_center',
    type: ZoneType.OASIS,
    center: OASIS_CENTER,
    radius: OASIS_RADIUS,
    foodMultiplier: 1,
    dangerMultiplier: 1,
  },
]]);

const createSpawnService = (obstacles: Map<string, Obstacle>): SpawnService => new SpawnService(
  new EventBus(),
  new GridManager(WORLD_SIZE, 25),
  oasisZones(),
  obstacles,
  new RandomStream(SEED),
  { foodStrategy: FoodSpawnStrategy.OASIS_PREFERRED },
  WORLD_CONFIG,
);

/** Positions of the food that the oasis strategy placed, over a run of spawn attempts. */
const spawnPositions = (spawnService: SpawnService): { x: number; y: number; z: number }[] => {
  const positions: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
    const food = spawnService.spawnFood(i + 1);
    if (food) positions.push(food.position);
  }
  return positions;
};

describe('SpawnService — food with the oasis strategy', () => {
  it('places food inside the oasis when the position is otherwise free', () => {
    const positions = spawnPositions(createSpawnService(new Map<string, Obstacle>()));

    const inOasis = positions.filter(p => distance(p, OASIS_CENTER) < OASIS_RADIUS);
    expect(inOasis.length).toBeGreaterThan(0);
  });

  it('keeps food out of an obstacle that sits inside the oasis', () => {
    const blocker = { id: 'obs_blocker', position: OASIS_CENTER, radius: 12 } as unknown as Obstacle;
    const obstacles = new Map<string, Obstacle>([[blocker.id, blocker]]);

    const positions = spawnPositions(createSpawnService(obstacles));

    const inOasis = positions.filter(p => distance(p, OASIS_CENTER) < OASIS_RADIUS);
    expect(inOasis.length).toBeGreaterThan(0);
    for (const p of positions) {
      expect(distance(p, blocker.position)).toBeGreaterThanOrEqual(blocker.radius + FOOD_MIN_OBSTACLE_DISTANCE);
    }
  });
});
