 
import { describe, expect, it } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { SimulationEngine } from '../engine/Engine';

const SEED = 4242;
const TICKS = 100;
const WALL_CLOCK_METADATA_KEYS = new Set(['spawnTime']);

const plain = (state: SerializedSimulationStateV1): unknown =>
  JSON.parse(JSON.stringify(state, (key, value: unknown) => (WALL_CLOCK_METADATA_KEYS.has(key) ? undefined : value)));

const runEngine = (): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed: SEED });
  engine.start();
  for (let i = 0; i < TICKS; i++) engine.update();
  return engine;
};

describe('snapshot round trip — export, import, export', () => {
  it('keeps the organism counters that the export writes', () => {
    const snapshot = runEngine().exportState();
    // Guard against a vacuous pass: the run must contain organisms with a non-zero hunt count.
    expect(snapshot.organisms.some(o => o.huntSuccessCount > 0)).toBe(true);

    const restored = new SimulationEngine(1, { seed: SEED + 1 });
    restored.importState(snapshot);

    const reExported = restored.exportState();
    for (const original of snapshot.organisms) {
      const copy = reExported.organisms.find(o => o.id === original.id);
      expect(copy?.huntSuccessCount, original.id).toBe(original.huntSuccessCount);
      expect(copy?.causeOfDeath, original.id).toBe(original.causeOfDeath);
    }
  });

  it('re-exports the same state it imported', () => {
    const snapshot = runEngine().exportState();

    const restored = new SimulationEngine(1, { seed: SEED + 1 });
    restored.importState(snapshot);

    expect(plain(restored.exportState())).toEqual(plain(snapshot));
  });
});
