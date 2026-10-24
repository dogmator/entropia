/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { BUFFER_LAYOUT } from '@/config';

import { SimulationEngine } from '../engine/Engine';
import { organismIdOf } from '../utils/EntityIds';

const SEED = 1337;
const TOLERANCE = 1e-3;

/** The numeric id that the render buffer stores for the entry at `index`. */
const organismEntryId = (data: Float32Array, index: number): number => data[index * BUFFER_LAYOUT.STRIDE + BUFFER_LAYOUT.OFFSETS.ID] ?? -1;

describe('SimulationEngine — resolving a render buffer entry', () => {
  it('resolves a living organism to the entity the buffer entry describes', async () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    const buffers = engine.getRenderData();
    expect(buffers.preyCount).toBeGreaterThan(0);

    const numericId = organismEntryId(buffers.prey, 0);
    const org = await engine.getEntityByNumericId('prey', numericId, false);

    expect(org?.id).toBe(organismIdOf(numericId));
    expect(org?.position.x).toBeCloseTo(buffers.prey[BUFFER_LAYOUT.OFFSETS.X] ?? NaN, 3);
    expect(org?.position.y).toBeCloseTo(buffers.prey[BUFFER_LAYOUT.OFFSETS.Y] ?? NaN, 3);
    expect(org?.position.z).toBeCloseTo(buffers.prey[BUFFER_LAYOUT.OFFSETS.Z] ?? NaN, 3);
  });

  it('keeps naming the same organism after the population around it changes', async () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    const before = engine.getRenderData();
    expect(before.preyCount).toBeGreaterThan(1);
    const target = organismEntryId(before.prey, 1);

    // Removing the first prey shifts every later buffer position, but not the id that the entry carries.
    const first = Array.from(engine.organisms.values()).find(org => org.isPrey);
    expect(first).toBeDefined();
    if (first) engine.organisms.delete(first.id);

    const org = await engine.getEntityByNumericId('prey', target, false);
    expect(org?.id).toBe(organismIdOf(target));
  });

  it('resolves a food item by the id its buffer entry carries', async () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    const food = engine.spawnService.spawnFood(++engine.foodIdCounter);
    expect(food).not.toBeNull();
    if (food) engine.entityManager.addFood(food);

    const buffers = engine.getRenderData();
    expect(buffers.foodCount).toBeGreaterThan(0);
    const numericId = buffers.food[BUFFER_LAYOUT.FOOD_OFFSETS.ID] ?? -1;

    const resolved = await engine.getEntityByNumericId('food', numericId, false);
    expect(resolved?.id).toBe(food?.id);
    expect(Math.abs((resolved?.position.x ?? NaN) - (buffers.food[BUFFER_LAYOUT.FOOD_OFFSETS.X] ?? NaN))).toBeLessThan(TOLERANCE);
  });

  it('does not resolve an id to an entity of the other kind', async () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    const buffers = engine.getRenderData();
    const numericId = organismEntryId(buffers.prey, 0);

    expect(await engine.getEntityByNumericId('predator', numericId, false)).toBeNull();
  });
});
