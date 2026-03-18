import { describe, expect, it } from 'vitest';

import { resolveRemoteLoggingEnabled } from '../remoteLogging';

const createStorage = (value: string | null): Pick<Storage, 'getItem'> => ({
  getItem: () => value
});

describe('resolveRemoteLoggingEnabled', () => {
  it('enables remote logging by default in development', () => {
    expect(resolveRemoteLoggingEnabled(createStorage(null), true)).toBe(true);
  });

  it('allows explicit disable in development', () => {
    expect(resolveRemoteLoggingEnabled(createStorage('0'), true)).toBe(false);
  });

  it('enables in production only with explicit opt-in', () => {
    expect(resolveRemoteLoggingEnabled(createStorage('1'), false)).toBe(true);
    expect(resolveRemoteLoggingEnabled(createStorage(null), false)).toBe(false);
    expect(resolveRemoteLoggingEnabled(createStorage('0'), false)).toBe(false);
  });
});

