import { describe, expect, it } from 'vitest';

import { EntityType } from '@/types';

import { SimulationEngine } from '../../engine/Engine';
import { BufferManager } from '../BufferManager.manager';

const FOOD_ID = 900_001;
const ORGANISM_STRIDE = 13;
const FOOD_STRIDE = 5;

describe('BufferManager', () => {
  it('returns exact counts while over-allocating capacity from upper bounds', () => {
    const engine = new SimulationEngine(1);
    const manager = new BufferManager();

    const prey = engine.spawnService.spawnOrganism(EntityType.PREY);
    const predator = engine.spawnService.spawnOrganism(EntityType.PREDATOR);
    const food = engine.spawnService.spawnFood(FOOD_ID);

    expect(prey).not.toBeNull();
    expect(predator).not.toBeNull();
    expect(food).not.toBeNull();

    if (!prey || !predator || !food) {
      return;
    }

    engine.organisms.clear();
    engine.deadOrganisms.clear();
    engine.food.clear();

    engine.organisms.set(prey.id, prey);
    predator.die('old_age');
    engine.deadOrganisms.set(predator.id, predator);
    engine.food.set(food.id, food);

    const renderData = manager.getRenderData(
      engine.organisms,
      engine.deadOrganisms,
      engine.food
    );

    expect(renderData.preyCount).toBe(1);
    expect(renderData.predatorCount).toBe(1);
    expect(renderData.foodCount).toBe(1);
    expect(renderData.prey.length).toBeGreaterThanOrEqual(renderData.preyCount * ORGANISM_STRIDE);
    expect(renderData.predators.length).toBeGreaterThanOrEqual(renderData.predatorCount * ORGANISM_STRIDE);
    expect(renderData.food.length).toBeGreaterThanOrEqual(renderData.foodCount * FOOD_STRIDE);
  });
});
