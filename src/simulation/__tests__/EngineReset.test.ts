 
import { describe, expect, it } from 'vitest';

import { BUFFER_LAYOUT } from '@/config';
import type { Organism } from '@/simulation/Entity';

import { SimulationEngine } from '../engine/Engine';

const SEED = 4242;
const DEAD_COUNT = 3;

/** How many of the first `count` entries of a render buffer carry the death flag. */
const countDeadEntries = (data: Float32Array, count: number): number => {
  let dead = 0;
  for (let i = 0; i < count; i++) {
    if ((data[i * BUFFER_LAYOUT.STRIDE + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD) dead++;
  }
  return dead;
};

/** Moves living organisms into the dead collection, as the death processor does at the end of a tick. */
const killOrganisms = (engine: SimulationEngine, count: number): Organism[] => {
  const killed = Array.from(engine.organisms.values()).slice(0, count);
  for (const org of killed) {
    org.die('old_age');
    engine.organisms.delete(org.id);
    engine.deadOrganisms.set(org.id, org);
  }
  return killed;
};

const kindOf = (org: Organism): 'prey' | 'predator' => (org.isPrey ? 'prey' : 'predator');

describe('SimulationEngine — reset after deaths', () => {
  it('leaves no dead organisms in the new world or in its render buffers', () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    killOrganisms(engine, DEAD_COUNT);
    const before = engine.getRenderData();
    expect(countDeadEntries(before.prey, before.preyCount) + countDeadEntries(before.predators, before.predatorCount)).toBe(DEAD_COUNT);

    engine.reset();

    expect(engine.deadOrganisms.size).toBe(0);
    const after = engine.getRenderData();
    expect(countDeadEntries(after.prey, after.preyCount)).toBe(0);
    expect(countDeadEntries(after.predators, after.predatorCount)).toBe(0);
  });

  it('reports the population of the new world at once, without a tick to refresh it', () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    killOrganisms(engine, DEAD_COUNT);

    engine.reset();

    const stats = engine.getStats();
    expect(stats.preyCount).toBe(Array.from(engine.organisms.values()).filter(org => org.isPrey).length);
    expect(stats.predatorCount).toBe(Array.from(engine.organisms.values()).filter(org => !org.isPrey).length);
    expect(stats.preyCount).toBeGreaterThan(0);
  });

  it('no longer resolves a body of the previous world by its id', async () => {
    const engine = new SimulationEngine(1, { seed: SEED });
    const [body] = killOrganisms(engine, 1);
    expect(body).toBeDefined();
    if (!body) return;
    const numericId = Number(body.id.split('_')[1]);
    expect(await engine.getEntityByNumericId(kindOf(body), numericId, true)).toBe(body);

    engine.reset();

    expect(await engine.getEntityByNumericId(kindOf(body), numericId, true)).toBeNull();
  });
});
