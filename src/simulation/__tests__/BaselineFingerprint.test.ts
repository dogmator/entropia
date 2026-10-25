/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { checksumOf } from '@/core/persistence/checksum.utils';
import { EngineState } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Stage J adds an opt-in resource stock. With the stock off, the simulation must keep the trajectory it had before, so this
// test pins a fingerprint of the full state at fixed ticks. A mismatch is a change of baseline dynamics. It has to be
// explained in the pull request, and the recorded values must not be updated just to make the test pass.
const SEEDS = [4242, 1, 3735928559];
const CHECKPOINTS = [100, 300];

// The state with its wall-clock metadata removed, so two runs can be compared.
const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const fingerprintsOf = (seed: number): string[] => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  return CHECKPOINTS.map(checkpoint => {
    while (engine.getTick() < checkpoint && engine.state === EngineState.RUNNING) engine.update();
    return checksumOf(comparable(engine));
  });
};

// Recorded on stage I (5d4742f), before the resource stock existed.
// Re-recorded for two corrections that change the trajectory from the first tick that uses them. Food may now lie in the
// oasis, which the default oasis strategy places it in; the rules for other zones and obstacles are unchanged. And a parent's
// radius follows its energy in the tick it reproduces, instead of lagging one tick behind the energy it spent.
// The stage I values were 4242: 6b0efd50, e437215b; 1: 54086bcf, 1bd4766d; 3735928559: 57faeabd, 3f55111a.
const RECORDED: Record<number, string[]> = {
  4242: ['d33c81bd', 'ce63bed1'],
  1: ['37f34d1d', 'ef5ec3c7'],
  3735928559: ['b2ec13f5', '50f4f152'],
};

describe('baseline trajectory with the resource stock off', () => {
  for (const seed of SEEDS) {
    it(`seed ${String(seed)} keeps its recorded fingerprints at ticks ${CHECKPOINTS.join(' and ')}`, () => {
      expect(fingerprintsOf(seed)).toEqual(RECORDED[seed]);
    });
  }
});
