/* eslint-disable @typescript-eslint/no-magic-numbers */
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import type { CheckpointInput } from '../CheckpointStore.service';
import { CheckpointStore } from '../CheckpointStore.service';
import { alterNewestCheckpoint } from './checkpointTestUtils';

const WORLD = 'default';

const checkpoint = (tick: number): CheckpointInput => ({
  worldId: WORLD,
  tick,
  savedAt: 1000 + tick,
  payload: JSON.stringify({ tick }),
});

describe('checkpoint retention: damaged records', () => {
  it('removes a damaged newest record when a newer checkpoint commits, and keeps the last intact one as the fallback', async () => {
    const factory = new FakeIDBFactory();
    const store = new CheckpointStore(factory);
    await store.commit(checkpoint(1));
    await store.commit(checkpoint(2));
    await alterNewestCheckpoint(factory, payload => `${payload} `);

    await store.commit(checkpoint(3));

    expect((await store.listNewestFirst(WORLD)).map(record => record.tick)).toEqual([3, 1]);
  });
});
