 
import { describe, expect, it } from 'vitest';

import { SimulationEngine } from '../engine/Engine';

const SEED = 4242;
const OTHER_SEED = 99;
const TICKS = 200;
const HALF_TICKS = 100;

// A new engine is READY, and update() is a no-op until start(). Without start() the runs would compare
// initial state only, so every run starts the engine first.
const runEngine = (seed: number, ticks: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  for (let i = 0; i < ticks; i++) engine.update();
  return engine;
};

// Food.spawnTime defaults to Date.now(). It is wall-clock metadata that only persistence reads, and no
// simulation logic depends on it. The statistics cache is time-based too, but it only feeds reported averages,
// which are not part of the exported state. Excluding spawnTime lets the test check the dynamics themselves.
const WALL_CLOCK_METADATA_KEYS = new Set(['spawnTime']);
const serialize = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (WALL_CLOCK_METADATA_KEYS.has(key) ? undefined : value));

describe('simulation determinism — documented model', () => {
  it('actually advances the requested number of ticks', () => {
    expect(runEngine(SEED, TICKS).getTick()).toBe(TICKS);
  });

  it('produces an identical exported state for the same seed and tick count', () => {
    expect(serialize(runEngine(SEED, TICKS))).toBe(serialize(runEngine(SEED, TICKS)));
  });

  it('produces a different state for a different seed', () => {
    expect(serialize(runEngine(SEED, TICKS))).not.toBe(serialize(runEngine(OTHER_SEED, TICKS)));
  });

  // Open defect, pinned on purpose: continuing an imported snapshot does not yet reproduce the uninterrupted run.
  // The export/import round trip is exact (see SnapshotRoundTrip.test.ts), but the first ticks after import diverge.
  // The cause is not isolated yet. This test must flip to an equality check once the defect is fixed.
  it('documents that continuing an imported snapshot is not yet exact (open defect)', () => {
    const expected = serialize(runEngine(SEED, TICKS));
    const snapshot = runEngine(SEED, HALF_TICKS).exportState();

    const restored = new SimulationEngine(1, { seed: OTHER_SEED });
    restored.importState(snapshot);
    restored.start();
    for (let i = 0; i < HALF_TICKS; i++) restored.update();

    expect(serialize(restored)).not.toBe(expected);
  });

  // Known limitation, pinned on purpose: the RNG lives in one module-level stream (core/utils/Random).
  // Creating a second engine resets it, so two engines in the same realm interfere. Fixing this needs a
  // per-engine RNG, which is an architectural change. When that lands, this test must flip and the docs change.
  it('documents the limitation that engines in one realm share one RNG stream', () => {
    const expected = serialize(runEngine(SEED, TICKS));

    const interleaved = new SimulationEngine(1, { seed: SEED });
    interleaved.start();
    for (let i = 0; i < HALF_TICKS; i++) interleaved.update();
    const intruder = new SimulationEngine(1, { seed: OTHER_SEED });
    expect(intruder.getSeed()).toBe(OTHER_SEED);
    for (let i = HALF_TICKS; i < TICKS; i++) interleaved.update();

    expect(serialize(interleaved)).not.toBe(expected);
  });
});
