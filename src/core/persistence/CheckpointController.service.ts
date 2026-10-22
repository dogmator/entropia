import type { SerializedSimulationStateV1 } from '@/types';

import type { CheckpointStore, StoredCheckpoint } from './CheckpointStore.service';
import { CHECKPOINT_SCHEMA_VERSION } from './CheckpointStore.service';
import { checksumOf } from './checksum.utils';
import type { LockOutcome } from './WorldLease.service';

export const DEFAULT_WORLD_ID = 'default';

/** What the controller needs from the simulation. EngineProxy provides both methods. */
export interface CheckpointEngine {
    exportState: () => Promise<SerializedSimulationStateV1>;
    importState: (state: SerializedSimulationStateV1) => Promise<void>;
}

export type CheckpointStatus =
    | { kind: 'starting' }
    | { kind: 'unavailable'; reason: string }
    | { kind: 'readOnly'; reason: string }
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; tick: number; savedAt: number }
    | { kind: 'recoveryAvailable'; tick: number; savedAt: number }
    | { kind: 'restored'; tick: number; source: 'checkpoint' | 'file'; skipped: string[] }
    | { kind: 'failed'; action: 'save' | 'restore' | 'import' | 'discard'; reason: string };

export interface CheckpointControllerOptions {
    worldId: string;
    engine: CheckpointEngine;
    store: CheckpointStore;
    acquireLock: () => Promise<LockOutcome>;
    now: () => number;
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// A checkpoint is usable only if its format is known and its payload still matches the checksum written with it.
const verifyCheckpoint = (record: StoredCheckpoint): string | null => {
    if (record.schema !== CHECKPOINT_SCHEMA_VERSION) return `format ${String(record.schema)} is not supported by this build`;
    if (checksumOf(record.payload) !== record.checksum) return 'checksum mismatch: the saved data is incomplete or altered';
    return null;
};

/**
 * Owns one world's checkpoints in the browser. Every operation runs in order on a queue, so a save never overlaps a
 * restore. Changes to the world and saves are allowed only in the tab that holds the writer lock. Other tabs can view.
 */
export class CheckpointController {
    private status: CheckpointStatus = { kind: 'starting' };
    private started = false;
    private lockHeld = false;
    private writer = false;
    private lastSaved: { tick: number; savedAt: number } | null = null;
    private queue: Promise<void> = Promise.resolve();
    private readonly listeners = new Set<() => void>();

    constructor(private readonly options: CheckpointControllerOptions) {}

    public readonly getStatus = (): CheckpointStatus => this.status;

    public readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    /** Takes the writer lock, then looks for a checkpoint to offer for recovery. Calling it again has no effect. */
    public start(): Promise<void> {
        if (this.started) return this.queue;
        this.started = true;
        return this.enqueue(() => this.acquireWriterLock());
    }

    public canWrite(): boolean {
        return this.writer;
    }

    /** Saves the current state unless its tick is already saved. Resolves only after the commit has completed. */
    public save(): Promise<void> {
        return this.enqueue(() => this.saveCurrentState());
    }

    /** Restores the newest checkpoint that verifies and imports. Older ones are tried only when newer ones fail. */
    public restore(): Promise<void> {
        return this.enqueue(() => this.restoreNewest());
    }

    /** Removes the saved checkpoints of this world. The caller must have asked the user to confirm. */
    public discard(): Promise<void> {
        return this.enqueue(async () => {
            if (!this.writer) return;
            try {
                await this.options.store.deleteWorld(this.options.worldId);
                this.lastSaved = null;
                this.setStatus({ kind: 'idle' });
            } catch (error) {
                this.setStatus({ kind: 'failed', action: 'discard', reason: reasonOf(error) });
            }
        });
    }

    /** Applies a snapshot the user picked from a file. A file that is not a valid snapshot leaves the live world unchanged. */
    public importText(text: string): Promise<void> {
        return this.enqueue(async () => {
            if (!this.lockHeld) return;
            let state: SerializedSimulationStateV1;
            try {
                state = JSON.parse(text) as SerializedSimulationStateV1;
            } catch {
                this.setStatus({ kind: 'failed', action: 'import', reason: 'The file is not valid JSON.' });
                return;
            }
            try {
                await this.options.engine.importState(state);
                // The imported world was never saved, so the next save must write it even if its tick is known.
                this.lastSaved = null;
                this.setStatus({ kind: 'restored', tick: state.tick, source: 'file', skipped: [] });
            } catch (error) {
                this.setStatus({ kind: 'failed', action: 'import', reason: reasonOf(error) });
            }
        });
    }

    public exportState(): Promise<SerializedSimulationStateV1> {
        return this.options.engine.exportState();
    }

    private enqueue(task: () => Promise<void>): Promise<void> {
        const run = this.queue.then(task);
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }

    private async acquireWriterLock(): Promise<void> {
        let outcome: LockOutcome;
        try {
            outcome = await this.options.acquireLock();
        } catch (error) {
            this.setStatus({ kind: 'unavailable', reason: reasonOf(error) });
            return;
        }
        if (outcome === 'unsupported') {
            this.setStatus({ kind: 'unavailable', reason: 'This browser cannot give one tab exclusive write access, so checkpoints are off.' });
            return;
        }
        if (outcome === 'busy') {
            this.setStatus({ kind: 'readOnly', reason: 'Another tab is writing this world. This tab can only view it.' });
            return;
        }
        this.lockHeld = true;
        await this.offerRecovery();
    }

    private async offerRecovery(): Promise<void> {
        try {
            const usable = (await this.options.store.listNewestFirst(this.options.worldId)).find(record => verifyCheckpoint(record) === null);
            this.writer = true;
            this.setStatus(usable
                ? { kind: 'recoveryAvailable', tick: usable.tick, savedAt: usable.savedAt }
                : { kind: 'idle' });
        } catch (error) {
            this.writer = false;
            this.setStatus({ kind: 'unavailable', reason: reasonOf(error) });
        }
    }

    private async saveCurrentState(): Promise<void> {
        if (!this.writer) return;
        try {
            const state = await this.options.engine.exportState();
            const last = this.lastSaved;
            if (last !== null && last.tick === state.tick) {
                this.setStatus({ kind: 'saved', tick: last.tick, savedAt: last.savedAt });
                return;
            }
            this.setStatus({ kind: 'saving' });
            const savedAt = this.options.now();
            await this.options.store.commit({ worldId: this.options.worldId, tick: state.tick, savedAt, payload: JSON.stringify(state) });
            this.lastSaved = { tick: state.tick, savedAt };
            this.setStatus({ kind: 'saved', tick: state.tick, savedAt });
        } catch (error) {
            this.setStatus({ kind: 'failed', action: 'save', reason: reasonOf(error) });
        }
    }

    private async restoreNewest(): Promise<void> {
        if (!this.writer) return;
        try {
            const candidates = await this.options.store.listNewestFirst(this.options.worldId);
            const skipped: string[] = [];
            for (const record of candidates) {
                const problem = await this.applyCheckpoint(record);
                if (problem === null) {
                    this.lastSaved = { tick: record.tick, savedAt: record.savedAt };
                    this.setStatus({ kind: 'restored', tick: record.tick, source: 'checkpoint', skipped });
                    return;
                }
                skipped.push(`tick ${String(record.tick)}: ${problem}`);
            }
            this.setStatus({
                kind: 'failed',
                action: 'restore',
                reason: candidates.length === 0 ? 'There is no saved world to resume.' : `No saved checkpoint could be restored (${skipped.join('; ')}).`,
            });
        } catch (error) {
            this.setStatus({ kind: 'failed', action: 'restore', reason: reasonOf(error) });
        }
    }

    /** Returns null once the checkpoint has been verified and imported, or the reason it was not. */
    private async applyCheckpoint(record: StoredCheckpoint): Promise<string | null> {
        const problem = verifyCheckpoint(record);
        if (problem !== null) return problem;
        let state: SerializedSimulationStateV1;
        try {
            state = JSON.parse(record.payload) as SerializedSimulationStateV1;
        } catch {
            return 'the saved data is not valid JSON';
        }
        try {
            await this.options.engine.importState(state);
            return null;
        } catch (error) {
            return reasonOf(error);
        }
    }

    private setStatus(status: CheckpointStatus): void {
        this.status = status;
        for (const listener of this.listeners) listener();
    }
}
