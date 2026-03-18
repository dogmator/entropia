import { describe, expect, it } from 'vitest';

import { EventBus } from '@/core';
import { EntityType, ZoneType, type EcologicalZone } from '@/types';

import type { Obstacle } from '@/simulation/Entity';
import { GridManager } from '@/simulation/managers/GridManager';
import { OrganismSpawnStrategy, SpawnService } from '@/simulation/services/SpawnService';

describe('SpawnService anomaly constraints', () => {
  it('не спавнит организмы внутри зон-аномалий', () => {
    const eventBus = new EventBus();
    const gridManager = new GridManager(100, 25);
    const zones = new Map<string, EcologicalZone>();
    const obstacles = new Map<string, Obstacle>();

    zones.set('center-zone', {
      id: 'center-zone',
      type: ZoneType.OASIS,
      center: { x: 50, y: 50, z: 50 },
      radius: 20,
      foodMultiplier: 1,
      dangerMultiplier: 1,
    });

    const spawnService = new SpawnService(eventBus, gridManager, zones, obstacles, {
      organismStrategy: OrganismSpawnStrategy.RANDOM,
      maxSpawnAttempts: 200,
      minOrganismDistance: 1,
    }, {
      WORLD_SIZE: 100,
      MAX_TOTAL_ORGANISMS: 100,
      INITIAL_PREY: 0,
      INITIAL_PREDATOR: 0,
      MAX_FOOD: 100,
      FOOD_SPAWN_RATE: 0.1,
    });

    const spawned = spawnService.spawnOrganism(EntityType.PREY);
    expect(spawned).not.toBeNull();
    if (!spawned) {
      return;
    }

    const dx = spawned.position.x - 50;
    const dy = spawned.position.y - 50;
    const dz = spawned.position.z - 50;
    const distSq = dx * dx + dy * dy + dz * dz;

    expect(distSq).toBeGreaterThan((20 + 1) ** 2);
  });

  it('не спавнит еду внутри зон-аномалий', () => {
    const eventBus = new EventBus();
    const gridManager = new GridManager(100, 25);
    const zones = new Map<string, EcologicalZone>();
    const obstacles = new Map<string, Obstacle>();

    zones.set('center-zone', {
      id: 'center-zone',
      type: ZoneType.OASIS,
      center: { x: 50, y: 50, z: 50 },
      radius: 20,
      foodMultiplier: 1,
      dangerMultiplier: 1,
    });

    const spawnService = new SpawnService(eventBus, gridManager, zones, obstacles, {
      maxSpawnAttempts: 200,
      minOrganismDistance: 1,
    }, {
      WORLD_SIZE: 100,
      MAX_TOTAL_ORGANISMS: 100,
      INITIAL_PREY: 0,
      INITIAL_PREDATOR: 0,
      MAX_FOOD: 100,
      FOOD_SPAWN_RATE: 0.1,
    });

    const spawnedFood = spawnService.spawnFood(1);
    expect(spawnedFood).not.toBeNull();
    if (!spawnedFood) {
      return;
    }

    const dx = spawnedFood.position.x - 50;
    const dy = spawnedFood.position.y - 50;
    const dz = spawnedFood.position.z - 50;
    const distSq = dx * dx + dy * dy + dz * dz;

    expect(distSq).toBeGreaterThan((20 + 5) ** 2);
  });
});
