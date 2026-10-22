/* eslint-disable @typescript-eslint/no-magic-numbers */
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import type { CheckpointInput } from '../CheckpointStore.service';
import { CheckpointStore, RETAINED_CHECKPOINTS } from '../CheckpointStore.service';

const WORLD = 'default';

const checkpoint = (tick: number, worldId = WORLD): CheckpointInput => ({
  worldId,
  tick,
  savedAt: 1000 + tick,
  payload: JSON.stringify({ tick }),
});

const createStore = (): CheckpointStore => new CheckpointStore(new FakeIDBFactory());

describe('checkpoint store: commits', () => {
  it('lists committed checkpoints newest first, with the sequence number and checksum written with them', async () => {
    const store = createStore();
    const first = await store.commit(checkpoint(1));
    const second = await store.commit(checkpoint(2));

    const listed = await store.listNewestFirst(WORLD);

    expect(listed.map(record => record.tick)).toEqual([2, 1]);
    expect(listed[0]?.seq).toBe(second);
    expect(listed[1]?.seq).toBe(first);
    expect(listed[0]?.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(listed[0]?.payload).toBe(JSON.stringify({ tick: 2 }));
  });

  it(`keeps only the newest ${String(RETAINED_CHECKPOINTS)} checkpoints of a world`, async () => {
    const store = createStore();
    for (let tick = 1; tick <= 4; tick++) await store.commit(checkpoint(tick));

    expect((await store.listNewestFirst(WORLD)).map(record => record.tick)).toEqual([4, 3]);
  });

  it('prunes one world without touching the checkpoints of another', async () => {
    const store = createStore();
    await store.commit(checkpoint(7, 'other'));
    for (let tick = 1; tick <= 3; tick++) await store.commit(checkpoint(tick));

    expect((await store.listNewestFirst('other')).map(record => record.tick)).toEqual([7]);
  });

  it('leaves the earlier checkpoints unchanged when a commit fails', async () => {
    const store = createStore();
    await store.commit(checkpoint(1));
    // A value that cannot be stored makes the write fail inside its transaction, which must then be rolled back.
    const broken = { ...checkpoint(2), tick: Symbol('not storable') as unknown as number };

    await expect(store.commit(broken)).rejects.toThrow();

    expect((await store.listNewestFirst(WORLD)).map(record => record.tick)).toEqual([1]);
  });
});

describe('checkpoint store: deletion and missing storage', () => {
  it('deletes one world and keeps the other', async () => {
    const store = createStore();
    await store.commit(checkpoint(1));
    await store.commit(checkpoint(2, 'other'));

    await store.deleteWorld(WORLD);

    expect(await store.listNewestFirst(WORLD)).toEqual([]);
    expect((await store.listNewestFirst('other')).map(record => record.tick)).toEqual([2]);
  });

  it('explains a full browser storage instead of reporting a generic failure', async () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    // The database opens, but starting a transaction throws the way a full quota does.
    const fullDatabase = { transaction: () => { throw quota; }, close: () => undefined } as unknown as IDBDatabase;
    const factory = {
      open: () => {
        const request: Record<string, unknown> = { result: fullDatabase };
        queueMicrotask(() => { (request['onsuccess'] as () => void)(); });
        return request as unknown as IDBOpenDBRequest;
      },
    } as unknown as IDBFactory;

    await expect(new CheckpointStore(factory).commit(checkpoint(1))).rejects.toThrow('Browser storage is full');
  });

  it('rejects with a reason when the browser has no IndexedDB, instead of pretending to save', async () => {
    const store = new CheckpointStore(undefined);

    await expect(store.commit(checkpoint(1))).rejects.toThrow(/no IndexedDB/);
    await expect(store.listNewestFirst(WORLD)).rejects.toThrow(/no IndexedDB/);
  });
});
