import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { alterNewestCheckpoint } from '@/core/persistence/__tests__/checkpointTestUtils';
import type { CheckpointEngine } from '@/core/persistence/CheckpointController.service';
import { CheckpointController } from '@/core/persistence/CheckpointController.service';
import { CheckpointStore } from '@/core/persistence/CheckpointStore.service';
import type { SerializedSimulationStateV1 } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Acceptance at the level of the engine and the browser store: a world saved to IndexedDB and restored into a fresh
// engine must continue exactly like the run that was never interrupted. The browser reload itself is covered by the
// Chromium smoke test.
const SEED = 4242;
const RESTORE_SEED = 99;
const FIRST_CHECKPOINT = 10;
const SECOND_CHECKPOINT = 20;
const HORIZON = 15;

const adaptEngine = (engine: SimulationEngine): CheckpointEngine => ({
  exportState: () => Promise.resolve(engine.exportState()),
  importState: (state: SerializedSimulationStateV1) => Promise.resolve().then(() => { engine.importState(state); }),
});

const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const advance = (engine: SimulationEngine, ticks: number): void => {
  for (let i = 0; i < ticks; i++) engine.update();
};

const controllerFor = (engine: SimulationEngine, store: CheckpointStore): CheckpointController =>
  new CheckpointController({
    worldId: 'default',
    engine: adaptEngine(engine),
    store,
    acquireLock: () => Promise.resolve('granted'),
    now: () => 1,
  });

// Returns the first tick at which the restored run and the reference run differ, or null over the whole horizon.
const firstDivergentTick = (reference: SimulationEngine, restored: SimulationEngine): number | null => {
  for (let i = 0; i < HORIZON; i++) {
    reference.update();
    restored.update();
    if (comparable(restored) !== comparable(reference)) return reference.getTick();
  }
  return null;
};

describe('checkpoint restore: continuation after a save', () => {
  it('restores a world saved to IndexedDB into a fresh engine and continues exactly like the uninterrupted run', async () => {
    const store = new CheckpointStore(new FakeIDBFactory() as unknown as IDBFactory);
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    advance(source, FIRST_CHECKPOINT);
    const writer = controllerFor(source, store);
    await writer.start();
    await writer.save();

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    const loader = controllerFor(restored, store);
    await loader.start();
    await loader.restore();
    restored.start();

    expect(loader.getStatus()).toEqual({ kind: 'restored', tick: FIRST_CHECKPOINT, source: 'checkpoint', skipped: [] });
    expect(firstDivergentTick(source, restored)).toBeNull();
  });

  it('restores the previous checkpoint when the newest is altered, and continues from that earlier tick', async () => {
    const factory = new FakeIDBFactory() as unknown as IDBFactory;
    const store = new CheckpointStore(factory);
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    advance(source, FIRST_CHECKPOINT);
    const writer = controllerFor(source, store);
    await writer.start();
    await writer.save();
    advance(source, SECOND_CHECKPOINT - FIRST_CHECKPOINT);
    await writer.save();
    await alterNewestCheckpoint(factory, payload => `${payload} `);

    const reference = new SimulationEngine(1, { seed: SEED });
    reference.start();
    advance(reference, FIRST_CHECKPOINT);
    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    const loader = controllerFor(restored, store);
    await loader.start();
    await loader.restore();
    restored.start();

    const status = loader.getStatus();
    expect(status).toMatchObject({ kind: 'restored', tick: FIRST_CHECKPOINT });
    expect(status.kind === 'restored' && status.skipped).toHaveLength(1);
    expect(firstDivergentTick(reference, restored)).toBeNull();
  });
});
