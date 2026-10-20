import { describe, expect, it } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Acceptance: a run restored from a snapshot must evolve exactly like the uninterrupted run, for several seeds and
// checkpoint positions. Documented conditions: the same world scale, the same configuration, and the wall-clock
// Food.spawnTime metadata excluded from the comparison, because no simulation logic reads it.
const SEED_FIRST = 4242;
const SEED_SECOND = 1;
const SEED_THIRD = 0xdeadbeef;
const RESTORE_SEED = 99;
const CHECKPOINT_EARLY = 25;
const CHECKPOINT_LATE = 100;
const HORIZON = 100;

const CASES: readonly (readonly [number, number])[] = [
  [SEED_FIRST, CHECKPOINT_EARLY],
  [SEED_FIRST, CHECKPOINT_LATE],
  [SEED_SECOND, CHECKPOINT_EARLY],
  [SEED_THIRD, CHECKPOINT_LATE],
];

const WALL_CLOCK_METADATA_KEYS = new Set(['spawnTime']);
const exported = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (WALL_CLOCK_METADATA_KEYS.has(key) ? undefined : value));

const createStarted = (seed: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  return engine;
};

describe('snapshot continuation acceptance', () => {
  it.each(CASES)('seed %i restored at tick %i continues like the uninterrupted run', (seed, checkpoint) => {
    const uninterrupted = createStarted(seed);
    for (let i = 0; i < checkpoint; i++) uninterrupted.update();

    // Round-trip through JSON, the form in which a snapshot is stored and transferred.
    const snapshot = JSON.parse(JSON.stringify(uninterrupted.exportState())) as SerializedSimulationStateV1;
    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(snapshot);
    restored.start();

    let divergentTick: number | null = null;
    for (let i = 0; i < HORIZON && divergentTick === null; i++) {
      uninterrupted.update();
      restored.update();
      if (exported(restored) !== exported(uninterrupted)) divergentTick = uninterrupted.getTick();
    }

    expect(divergentTick).toBeNull();
    expect(restored.getTick()).toBe(checkpoint + HORIZON);
  });
});
