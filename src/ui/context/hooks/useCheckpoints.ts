import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type { CheckpointEngine, CheckpointStatus } from '@/core/persistence/CheckpointController.service';
import { CheckpointController, DEFAULT_WORLD_ID } from '@/core/persistence/CheckpointController.service';
import { CheckpointStore } from '@/core/persistence/CheckpointStore.service';
import { requestWorldLock } from '@/core/persistence/WorldLease.service';
import type { SerializedSimulationStateV1 } from '@/types';

export const AUTOSAVE_INTERVAL_MS = 30_000;

// Read only when a save is committed, never during render.
const currentTime = (): number => Date.now();

type RunState = 'running' | 'paused' | 'stopped';

export interface CheckpointControls {
    status: CheckpointStatus;
    canWrite: boolean;
    save: () => Promise<void>;
    restore: () => Promise<void>;
    discard: () => Promise<void>;
    importText: (text: string) => Promise<void>;
    exportState: () => Promise<SerializedSimulationStateV1>;
}

// Saves on a fixed wall-clock cadence while the world runs. Each save commits only when the tick has changed.
const useAutosave = (controller: CheckpointController, runState: RunState): void => {
    useEffect(() => {
        if (runState !== 'running') return undefined;
        const timer = window.setInterval(() => { void controller.save(); }, AUTOSAVE_INTERVAL_MS);
        return () => { window.clearInterval(timer); };
    }, [controller, runState]);
};

// A pause or a stop is the moment a user expects the world to be kept, so it is saved at once.
const useSaveOnPause = (controller: CheckpointController, runState: RunState): void => {
    const previous = useRef(runState);
    useEffect(() => {
        const isPreviouslyRunning = previous.current === 'running';
        previous.current = runState;
        if (isPreviouslyRunning && runState !== 'running') void controller.save();
    }, [controller, runState]);
};

// Best effort only: the browser does not wait for an asynchronous write when a page is hidden or closed, so the save may
// not finish. The next start recovers from the last checkpoint that did commit.
const useSaveWhenLeaving = (controller: CheckpointController): void => {
    useEffect(() => {
        const saveWhenHidden = (): void => {
            if (document.visibilityState === 'hidden') void controller.save();
        };
        const saveNow = (): void => { void controller.save(); };
        document.addEventListener('visibilitychange', saveWhenHidden);
        window.addEventListener('pagehide', saveNow);
        return () => {
            document.removeEventListener('visibilitychange', saveWhenHidden);
            window.removeEventListener('pagehide', saveNow);
        };
    }, [controller]);
};

const useStartOnce = (controller: CheckpointController): void => {
    useEffect(() => { void controller.start(); }, [controller]);
};

// Some browsers throw when IndexedDB is read, for example in privacy modes. That means no storage, not a broken page.
const readIndexedDb = (): IDBFactory | undefined => {
    try {
        return window.indexedDB;
    } catch {
        return undefined;
    }
};

export const useCheckpoints = (engine: CheckpointEngine, runState: RunState): CheckpointControls => {
    const controller = useMemo(() => new CheckpointController({
        worldId: DEFAULT_WORLD_ID,
        engine,
        store: new CheckpointStore(readIndexedDb()),
        acquireLock: () => requestWorldLock(DEFAULT_WORLD_ID),
        now: currentTime,
    }), [engine]);
    const status = useSyncExternalStore(controller.subscribe, controller.getStatus);

    useStartOnce(controller);
    useAutosave(controller, runState);
    useSaveOnPause(controller, runState);
    useSaveWhenLeaving(controller);

    return useMemo<CheckpointControls>(() => ({
        status,
        canWrite: controller.canWrite(),
        save: () => controller.save(),
        restore: () => controller.restore(),
        discard: () => controller.discard(),
        importText: (text: string) => controller.importText(text),
        exportState: () => controller.exportState(),
    }), [controller, status]);
};
