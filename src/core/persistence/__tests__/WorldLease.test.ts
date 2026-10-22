import { afterEach, describe, expect, it } from 'vitest';

import { requestWorldLock } from '../WorldLease.service';

type LockCallback = (lock: object | null) => Promise<void> | undefined;

// Minimal stand-in for navigator.locks: a name can be held by one holder, and ifAvailable requests never queue.
const installLockManager = (): Set<string> => {
  const held = new Set<string>();
  const locks = {
    request: (name: string, _options: { ifAvailable: true }, callback: LockCallback): Promise<unknown> => {
      if (held.has(name)) return Promise.resolve(callback(null));
      held.add(name);
      return Promise.resolve(callback({ name }));
    },
  };
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return held;
};

afterEach(() => {
  Reflect.deleteProperty(navigator, 'locks');
});

describe('world lease', () => {
  it('reports unsupported when the browser has no Web Locks, so the caller can switch checkpoints off', async () => {
    await expect(requestWorldLock('default')).resolves.toBe('unsupported');
  });

  it('grants the lock to the first requester and reports busy to the second', async () => {
    installLockManager();

    await expect(requestWorldLock('default')).resolves.toBe('granted');
    await expect(requestWorldLock('default')).resolves.toBe('busy');
  });

  it('keeps locks of different worlds apart', async () => {
    installLockManager();

    await expect(requestWorldLock('default')).resolves.toBe('granted');
    await expect(requestWorldLock('other')).resolves.toBe('granted');
  });
});
