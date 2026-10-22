import { describe, expect, it } from 'vitest';

import { checksumOf } from '../checksum.utils';

describe('checksumOf', () => {
  it('matches the published FNV-1a 32-bit vectors', () => {
    expect(checksumOf('')).toBe('811c9dc5');
    expect(checksumOf('a')).toBe('e40c292c');
  });

  it('changes when a single character of the payload changes', () => {
    expect(checksumOf('{"tick":12}')).not.toBe(checksumOf('{"tick":13}'));
  });
});
