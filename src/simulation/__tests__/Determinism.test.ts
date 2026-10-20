 
import { describe, expect, it } from 'vitest';

import { SimulationEngine } from '../engine/Engine';

const SEED = 4242;
const OTHER_SEED = 99;
const TICKS = 200;
const HALF_TICKS = 100;

const runEngine = (seed: number, ticks: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed });
  for (let i = 0; i < ticks; i++) engine.update();
  return engine;
};

const serialize = (engine: SimulationEngine): string => JSON.stringify(engine.exportState());

describe('simulation determinism — documented model', () => {
  it('produces an identical exported state for the same seed and tick count', () => {
    expect(serialize(runEngine(SEED, TICKS))).toBe(serialize(runEngine(SEED, TICKS)));
  });

  it('produces a different state for a different seed', () => {
    expect(serialize(runEngine(SEED, TICKS))).not.toBe(serialize(runEngine(OTHER_SEED, TICKS)));
  });

  it('continues an imported snapshot exactly like the uninterrupted run', () => {
    const expected = serialize(runEngine(SEED, TICKS));
    const snapshot = runEngine(SEED, HALF_TICKS).exportState();

    const restored = new SimulationEngine(1, { seed: OTHER_SEED });
    restored.importState(snapshot);
    for (let i = 0; i < HALF_TICKS; i++) restored.update();

    expect(serialize(restored)).toBe(expected);
  });

  // Known limitation, pinned on purpose: the RNG lives in one module-level stream (core/utils/Random).
  // Creating a second engine resets it, so two engines in the same realm interfere. Fixing this needs a
  // per-engine RNG, which is an architectural change. When that lands, this test must flip and the docs change.
  it('documents the limitation that engines in one realm share one RNG stream', () => {
    const expected = serialize(runEngine(SEED, TICKS));

    const interleaved = new SimulationEngine(1, { seed: SEED });
    for (let i = 0; i < HALF_TICKS; i++) interleaved.update();
    const intruder = new SimulationEngine(1, { seed: OTHER_SEED });
    expect(intruder.getSeed()).toBe(OTHER_SEED);
    for (let i = HALF_TICKS; i < TICKS; i++) interleaved.update();

    expect(serialize(interleaved)).not.toBe(expected);
  });
});
