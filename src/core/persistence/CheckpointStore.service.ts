import { checksumOf } from './checksum.utils';

export const CHECKPOINT_DB_NAME = 'entropia-checkpoints';
export const CHECKPOINT_SCHEMA_VERSION = 1;
// Two checkpoints are kept, so that a corrupt newest one still leaves a verified one to fall back to.
export const RETAINED_CHECKPOINTS = 2;
const DB_VERSION = 1;
const CHECKPOINTS = 'checkpoints';
const BY_WORLD = 'byWorld';

export interface CheckpointInput {
    worldId: string;
    tick: number;
    savedAt: number;
    payload: string;
}

export interface StoredCheckpoint extends CheckpointInput {
    seq: number;
    schema: number;
    checksum: string;
}

const errorName = (error: unknown): string => (
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : ''
);

const describeStorageError = (error: unknown): string => {
    switch (errorName(error)) {
        case 'QuotaExceededError': return 'Browser storage is full. Free space, then save again.';
        case 'AbortError': return 'The write was rolled back. The earlier checkpoints are unchanged.';
        case 'VersionError': return 'The checkpoint database was written by a newer version of this application.';
        case 'InvalidStateError': return 'Browser storage is closed for this page.';
        default: return error instanceof Error ? error.message : 'Browser storage failed.';
    }
};

// Errors thrown synchronously by IndexedDB (for example a full quota) get the same reason text as asynchronous ones.
const storageFailure = (error: unknown): Error => new Error(describeStorageError(error));

const createSchema = (database: IDBDatabase): void => {
    const checkpoints = database.createObjectStore(CHECKPOINTS, { keyPath: 'seq', autoIncrement: true });
    checkpoints.createIndex(BY_WORLD, 'worldId');
};

const connect = (factory: IDBFactory): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = factory.open(CHECKPOINT_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { createSchema(request.result); };
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(storageFailure(request.error)); };
    request.onblocked = () => {
        reject(new Error('Another tab holds the checkpoint database open. Close that tab, then try again.'));
    };
});

/** A record can be restored only if its format is known and its payload still matches the checksum written with it. */
export const isIntact = (record: StoredCheckpoint): boolean =>
    record.schema === CHECKPOINT_SCHEMA_VERSION && checksumOf(record.payload) === record.checksum;

// Keeps the newest RETAINED_CHECKPOINTS records of one world that are still intact, and removes the rest. A damaged record
// goes as soon as a newer one commits, so the last good fallback is never pushed out by a record that cannot be restored.
// It runs inside the transaction that adds a checkpoint, so a checkpoint and the pruning of older ones commit together.
const pruneWorld = (store: IDBObjectStore, worldId: string): void => {
    const request = store.index(BY_WORLD).getAll(worldId);
    request.onsuccess = () => {
        const stored = request.result as StoredCheckpoint[];
        const kept = new Set(stored.filter(isIntact).slice(-RETAINED_CHECKPOINTS).map(record => record.seq));
        for (const record of stored) {
            if (!kept.has(record.seq)) store.delete(record.seq);
        }
    };
};

const rejectOnFailure = (transaction: IDBTransaction, reject: (reason: Error) => void): void => {
    transaction.onerror = () => { reject(storageFailure(transaction.error)); };
    transaction.onabort = () => { reject(storageFailure(transaction.error)); };
};

/**
 * Browser-local checkpoints in IndexedDB. A checkpoint becomes visible only in the transaction that commits it, so the
 * newest committed checkpoint is the last-known-good one: nothing needs to move a separate pointer.
 * `factory` is undefined when the browser has no IndexedDB. Every call then rejects with a reason.
 */
export class CheckpointStore {
    private databasePromise: Promise<IDBDatabase> | null = null;

    constructor(private readonly factory: IDBFactory | undefined) {}

    /** Resolves with the sequence number once the transaction has committed. */
    public async commit(input: CheckpointInput): Promise<number> {
        const checksum = checksumOf(input.payload);
        const database = await this.openDatabase();
        return new Promise<number>((resolve, reject) => {
            try {
                const transaction = database.transaction(CHECKPOINTS, 'readwrite');
                const store = transaction.objectStore(CHECKPOINTS);
                const added = store.add({ ...input, schema: CHECKPOINT_SCHEMA_VERSION, checksum });
                let seq = 0;
                added.onsuccess = () => {
                    seq = Number(added.result);
                    pruneWorld(store, input.worldId);
                };
                transaction.oncomplete = () => { resolve(seq); };
                rejectOnFailure(transaction, reject);
            } catch (error) {
                reject(storageFailure(error));
            }
        });
    }

    /** Newest first. Records are returned as stored, without any verification. */
    public async listNewestFirst(worldId: string): Promise<StoredCheckpoint[]> {
        const database = await this.openDatabase();
        return new Promise<StoredCheckpoint[]>((resolve, reject) => {
            try {
                const request = database.transaction(CHECKPOINTS, 'readonly').objectStore(CHECKPOINTS).index(BY_WORLD).getAll(worldId);
                request.onsuccess = () => { resolve((request.result as StoredCheckpoint[]).reverse()); };
                request.onerror = () => { reject(storageFailure(request.error)); };
            } catch (error) {
                reject(storageFailure(error));
            }
        });
    }

    /** Removes every checkpoint of one world. The caller decides when this is wanted. */
    public async deleteWorld(worldId: string): Promise<void> {
        const database = await this.openDatabase();
        return new Promise<void>((resolve, reject) => {
            try {
                const transaction = database.transaction(CHECKPOINTS, 'readwrite');
                const store = transaction.objectStore(CHECKPOINTS);
                const keys = store.index(BY_WORLD).getAllKeys(worldId);
                keys.onsuccess = () => {
                    for (const key of keys.result) store.delete(key);
                };
                transaction.oncomplete = () => { resolve(); };
                rejectOnFailure(transaction, reject);
            } catch (error) {
                reject(storageFailure(error));
            }
        });
    }

    private openDatabase(): Promise<IDBDatabase> {
        if (!this.factory) return Promise.reject(new Error('This browser has no IndexedDB, so checkpoints are unavailable.'));
        this.databasePromise ??= connect(this.factory).catch((error: unknown) => {
            this.databasePromise = null;
            throw error;
        });
        return this.databasePromise;
    }
}
