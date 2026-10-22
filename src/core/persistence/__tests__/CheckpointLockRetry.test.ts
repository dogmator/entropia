/* eslint-disable @typescript-eslint/no-magic-numbers */
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { CheckpointController } from '../CheckpointController.service';
import { CheckpointStore } from '../CheckpointStore.service';
import type { LockOutcome } from '../WorldLease.service';

const WORLD = 'default';
// The controller's LOCK_RETRY_INTERVAL_MS. The test states the value, because the constant is not exported.
const RETRY_INTERVAL_MS = 5_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('checkpoint controller: writer lock retry', () => {
  it('a read-only tab becomes the writer once the other tab releases the lock', async () => {
    // Only the timer is faked. The store's IndexedDB work runs on the real scheduler.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let outcome: LockOutcome = 'busy';
    const engine = {
      exportState: () => Promise.resolve({ tick: 1, config: 'default' } as unknown as SerializedSimulationStateV1),
      importState: () => Promise.resolve(),
    };
    const controller = new CheckpointController({
      worldId: WORLD,
      engine,
      store: new CheckpointStore(new FakeIDBFactory()),
      acquireLock: () => Promise.resolve(outcome),
      now: () => 5000,
    });

    await controller.start();
    expect(controller.getStatus()).toMatchObject({ kind: 'readOnly' });
    expect(controller.canWrite()).toBe(false);

    outcome = 'granted';
    await vi.advanceTimersByTimeAsync(RETRY_INTERVAL_MS);
    await vi.waitFor(() => { expect(controller.canWrite()).toBe(true); });

    expect(['idle', 'recoveryAvailable']).toContain(controller.getStatus().kind);
  });
});
