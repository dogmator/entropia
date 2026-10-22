/* eslint-disable @typescript-eslint/no-magic-numbers, max-lines-per-function */
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import type { CheckpointEngine } from '../CheckpointController.service';
import { CheckpointController } from '../CheckpointController.service';
import { CheckpointStore } from '../CheckpointStore.service';
import type { LockOutcome } from '../WorldLease.service';
import { alterNewestCheckpoint } from './checkpointTestUtils';

const WORLD = 'default';

// The controller reads the tick and the content of a state, so a state with those fields stands in for a real one.
const fakeWorld = (initialTick: number) => {
  const world = { tick: initialTick, config: 'default', imports: [] as number[], rejectImportsOf: new Set<number>() };
  const engine: CheckpointEngine = {
    exportState: () => Promise.resolve({ tick: world.tick, config: world.config } as unknown as SerializedSimulationStateV1),
    importState: (state) => {
      const { tick } = state as unknown as { tick: number };
      if (world.rejectImportsOf.has(tick)) return Promise.reject(new Error(`engine rejected the snapshot at tick ${String(tick)}`));
      world.tick = tick;
      world.imports.push(tick);
      return Promise.resolve();
    },
  };
  return { world, engine };
};

interface HarnessOptions { lock?: LockOutcome; initialTick?: number; factory?: IDBFactory; onWorldReplaced?: () => void }

const createHarness = (options: HarnessOptions = {}) => {
  const factory = options.factory ?? (new FakeIDBFactory() as unknown as IDBFactory);
  const store = new CheckpointStore(factory);
  const { world, engine } = fakeWorld(options.initialTick ?? 1);
  let clock = 5000;
  const acquireLock = vi.fn((): Promise<LockOutcome> => Promise.resolve(options.lock ?? 'granted'));
  const controller = new CheckpointController({
    worldId: WORLD,
    engine,
    store,
    acquireLock,
    now: () => { clock += 1; return clock; },
    onWorldReplaced: options.onWorldReplaced,
  });
  return { factory, store, world, controller, acquireLock };
};

const ticksOf = async (store: CheckpointStore): Promise<number[]> =>
  (await store.listNewestFirst(WORLD)).map(record => record.tick);

describe('checkpoint controller: writer lock', () => {
  it('becomes the writer when the lock is granted and nothing is saved yet', async () => {
    const { controller } = createHarness();

    await controller.start();

    expect(controller.getStatus()).toEqual({ kind: 'idle' });
    expect(controller.canWrite()).toBe(true);
  });

  it('is read-only, and writes nothing, while another tab holds the lock', async () => {
    const { controller, store, world } = createHarness({ lock: 'busy', initialTick: 4 });

    await controller.start();
    await controller.save();
    await controller.restore();
    await controller.discard();

    expect(controller.getStatus().kind).toBe('readOnly');
    expect(controller.canWrite()).toBe(false);
    expect(await ticksOf(store)).toEqual([]);
    expect(world.imports).toEqual([]);
  });

  it('reports unavailable, not a silent save, when the browser cannot grant an exclusive writer', async () => {
    const { controller } = createHarness({ lock: 'unsupported' });

    await controller.start();

    expect(controller.getStatus()).toMatchObject({ kind: 'unavailable' });
    expect(controller.canWrite()).toBe(false);
  });

  it('requests the lock once, however often start is called', async () => {
    const { controller, acquireLock } = createHarness();

    await controller.start();
    await controller.start();

    expect(acquireLock).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable when IndexedDB does not exist in this browser', async () => {
    const controller = new CheckpointController({
      worldId: WORLD,
      engine: fakeWorld(1).engine,
      store: new CheckpointStore(undefined),
      acquireLock: () => Promise.resolve('granted'),
      now: () => 1,
    });

    await controller.start();

    expect(controller.getStatus()).toMatchObject({ kind: 'unavailable' });
    expect(controller.canWrite()).toBe(false);
  });
});

describe('checkpoint controller: saving', () => {
  it('reports saved only once the checkpoint is committed', async () => {
    const { controller, store } = createHarness({ initialTick: 12 });
    await controller.start();

    await controller.save();

    expect(controller.getStatus()).toMatchObject({ kind: 'saved', tick: 12 });
    expect(await ticksOf(store)).toEqual([12]);
  });

  it('does not write a second checkpoint for a tick that is already saved', async () => {
    const { controller, store } = createHarness({ initialTick: 3 });
    await controller.start();

    await controller.save();
    await controller.save();

    expect(await ticksOf(store)).toEqual([3]);
  });

  it('keeps the two newest checkpoints as the world advances', async () => {
    const { controller, store, world } = createHarness();
    await controller.start();

    for (const tick of [1, 2, 3]) {
      world.tick = tick;
      await controller.save();
    }

    expect(await ticksOf(store)).toEqual([3, 2]);
  });

  it('reports a failed save and keeps the checkpoints that were already committed', async () => {
    const { controller, store, world } = createHarness({ initialTick: 5 });
    await controller.start();
    await controller.save();
    // A tick that cannot be stored makes the commit fail inside its transaction.
    world.tick = Symbol('not storable') as unknown as number;

    await controller.save();

    expect(controller.getStatus()).toMatchObject({ kind: 'failed', action: 'save' });
    expect(await ticksOf(store)).toEqual([5]);
  });

  it('notifies subscribers when the status changes', async () => {
    const { controller } = createHarness({ initialTick: 2 });
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.start();

    await controller.save();

    expect(listener).toHaveBeenCalled();
  });
});

describe('checkpoint controller: recovery', () => {
  it('offers the newest verified checkpoint when a world starts', async () => {
    const first = createHarness({ initialTick: 9 });
    await first.controller.start();
    await first.controller.save();

    const second = createHarness({ factory: first.factory });
    await second.controller.start();

    expect(second.controller.getStatus()).toMatchObject({ kind: 'recoveryAvailable', tick: 9 });
  });

  it('resumes the newest checkpoint', async () => {
    const first = createHarness({ initialTick: 5 });
    await first.controller.start();
    await first.controller.save();
    first.world.tick = 9;
    await first.controller.save();

    const second = createHarness({ factory: first.factory });
    await second.controller.start();
    await second.controller.restore();

    expect(second.controller.getStatus()).toEqual({ kind: 'restored', tick: 9, source: 'checkpoint', skipped: [] });
    expect(second.world.tick).toBe(9);
  });

  it('falls back to the previous checkpoint and reports the downgrade when the newest is altered', async () => {
    const first = createHarness({ initialTick: 5 });
    await first.controller.start();
    await first.controller.save();
    first.world.tick = 9;
    await first.controller.save();
    await alterNewestCheckpoint(first.factory, payload => `${payload} `);

    const second = createHarness({ factory: first.factory });
    await second.controller.start();
    await second.controller.restore();

    expect(second.world.tick).toBe(5);
    const status = second.controller.getStatus();
    expect(status).toMatchObject({ kind: 'restored', tick: 5, source: 'checkpoint' });
    expect(status.kind === 'restored' && status.skipped[0]).toContain('checksum mismatch');
  });

  it('falls back when the engine rejects the newest snapshot, and leaves the world unchanged by that rejection', async () => {
    const first = createHarness({ initialTick: 5 });
    await first.controller.start();
    await first.controller.save();
    first.world.tick = 9;
    await first.controller.save();

    const second = createHarness({ factory: first.factory, initialTick: 1 });
    second.world.rejectImportsOf.add(9);
    await second.controller.start();
    await second.controller.restore();

    expect(second.world.tick).toBe(5);
    expect(second.world.imports).toEqual([5]);
    expect(second.controller.getStatus()).toMatchObject({ kind: 'restored', tick: 5 });
  });

  it('reports a failure and leaves the world unchanged when no checkpoint can be restored', async () => {
    const first = createHarness({ initialTick: 5 });
    await first.controller.start();
    await first.controller.save();
    await alterNewestCheckpoint(first.factory, payload => `${payload} `);

    const second = createHarness({ factory: first.factory, initialTick: 1 });
    await second.controller.start();
    await second.controller.restore();

    expect(second.controller.getStatus()).toMatchObject({ kind: 'failed', action: 'restore' });
    expect(second.world.tick).toBe(1);
    expect(second.world.imports).toEqual([]);
  });

  it('does not restore from a tab that does not hold the lock', async () => {
    const first = createHarness({ initialTick: 5 });
    await first.controller.start();
    await first.controller.save();

    const second = createHarness({ factory: first.factory, lock: 'busy', initialTick: 1 });
    await second.controller.start();
    await second.controller.restore();

    expect(second.world.imports).toEqual([]);
  });

  it('runs operations in the order they were requested, so a restore after a save restores that save', async () => {
    const { controller, world } = createHarness({ initialTick: 3 });
    await controller.start();

    const saving = controller.save();
    world.tick = 7;
    const restoring = controller.restore();
    await Promise.all([saving, restoring]);

    expect(controller.getStatus()).toMatchObject({ kind: 'restored', tick: 7 });
  });
});

describe('checkpoint controller: file import and discard', () => {
  it('imports a snapshot from a file, and then saves it even though its tick was saved before', async () => {
    const { controller, store, world } = createHarness({ initialTick: 4 });
    await controller.start();
    await controller.save();

    await controller.importText(JSON.stringify({ tick: 4 }));
    await controller.save();

    expect(world.imports).toEqual([4]);
    expect(await ticksOf(store)).toEqual([4, 4]);
  });

  it('reports a rejected file import and keeps the live world', async () => {
    const { controller, world } = createHarness({ initialTick: 6 });
    world.rejectImportsOf.add(2);
    await controller.start();

    await controller.importText(JSON.stringify({ tick: 2 }));

    expect(controller.getStatus()).toMatchObject({ kind: 'failed', action: 'import' });
    expect(world.tick).toBe(6);
  });

  it('reports a file that is not JSON and keeps the live world', async () => {
    const { controller, world } = createHarness({ initialTick: 6 });
    await controller.start();

    await controller.importText('{"tick":');

    expect(controller.getStatus()).toEqual({ kind: 'failed', action: 'import', reason: 'The file is not valid JSON.' });
    expect(world.tick).toBe(6);
    expect(world.imports).toEqual([]);
  });

  it('discards the saved world only when asked, and reports idle afterwards', async () => {
    const { controller, store } = createHarness({ initialTick: 8 });
    await controller.start();
    await controller.save();

    await controller.discard();

    expect(controller.getStatus()).toEqual({ kind: 'idle' });
    expect(await ticksOf(store)).toEqual([]);
  });
});

describe('checkpoint controller: content and recovery decisions', () => {
  it('saves a change made at the same tick, because the content differs', async () => {
    const { controller, store, world } = createHarness({ initialTick: 5 });
    await controller.start();
    await controller.save();

    world.config = 'changed while paused';
    await controller.save();

    expect(await ticksOf(store)).toEqual([5, 5]);
  });

  it('does not overwrite a checkpoint offered for recovery before the user decides', async () => {
    const first = createHarness({ initialTick: 9 });
    await first.controller.start();
    await first.controller.save();

    const second = createHarness({ factory: first.factory, initialTick: 1 });
    await second.controller.start();
    await second.controller.save();

    expect(second.controller.getStatus()).toMatchObject({ kind: 'recoveryAvailable', tick: 9 });
    expect(await ticksOf(first.store)).toEqual([9]);
  });

  it('starts saving again once the user has resumed the offered checkpoint', async () => {
    const first = createHarness({ initialTick: 9 });
    await first.controller.start();
    await first.controller.save();

    const second = createHarness({ factory: first.factory, initialTick: 1 });
    await second.controller.start();
    await second.controller.restore();
    second.world.tick = 10;
    await second.controller.save();

    expect(await ticksOf(second.store)).toEqual([10, 9]);
  });

  it('tells the caller when a restore replaces the world', async () => {
    const first = createHarness({ initialTick: 4 });
    await first.controller.start();
    await first.controller.save();

    const onWorldReplaced = vi.fn();
    const second = createHarness({ factory: first.factory, initialTick: 1, onWorldReplaced });
    await second.controller.start();
    await second.controller.restore();

    expect(onWorldReplaced).toHaveBeenCalledTimes(1);
  });
});
