export type LockOutcome = 'granted' | 'busy' | 'unsupported';

const lockName = (worldId: string): string => `entropia-world:${worldId}`;

/**
 * Asks for the single-writer lock of one world without waiting. `granted` means this page now holds the lock. The lock is
 * kept until the page unloads, and the browser releases it then, so a crashed tab never blocks the world for good.
 */
export const requestWorldLock = (worldId: string): Promise<LockOutcome> => {
    if (!('locks' in navigator)) return Promise.resolve('unsupported');
    return new Promise<LockOutcome>((resolve, reject) => {
        navigator.locks.request(lockName(worldId), { ifAvailable: true }, (lock) => {
            resolve(lock ? 'granted' : 'busy');
            // A promise that never settles keeps the lock held for the lifetime of the page.
            return lock ? new Promise<void>(() => undefined) : undefined;
        }).catch(reject);
    });
};
