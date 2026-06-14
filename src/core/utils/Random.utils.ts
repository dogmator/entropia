// Magic constants for MurmurHash3-based PRNG (well-known bit-mixing constants)
const MURMURHASH_INC = 0x6d2b79f5;
const UINT32_MAX = 0xffffffff;
const MIX_SHIFT_15 = 15;
const MIX_SHIFT_7 = 7;
const MIX_OR_61 = 61;
const MIX_SHIFT_14 = 14;
const UINT32_DIVISOR = 4294967296;
const DEFAULT_BOOL_PROBABILITY = 0.5;

let _state = 0;

export function getState(): number {
  return _state;
}

export function setState(state: number): void {
  _state = state >>> 0;
}

export function fromMath(): void {
  // eslint-disable-next-line sonarjs/pseudo-random
  _state = (Math.random() * UINT32_MAX) >>> 0;
}

export function reset(seed: number): void {
  _state = seed >>> 0;
}

export function next(): number {
  _state = (_state + MURMURHASH_INC) >>> 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> MIX_SHIFT_15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> MIX_SHIFT_7), t | MIX_OR_61);
  return ((t ^ (t >>> MIX_SHIFT_14)) >>> 0) / UINT32_DIVISOR;
}

export function float(min: number, max: number): number {
  return min + (max - min) * next();
}

export function int(minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) {
    throw new Error('Invalid range: maxInclusive < minInclusive');
  }
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(next() * span);
}

export function bool(probability = DEFAULT_BOOL_PROBABILITY): boolean {
  return next() < probability;
}

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick an element from an empty array');
  }
  const index = int(0, items.length - 1);
  // index is guaranteed to be in [0, items.length-1]
  return items[index] as T;
}

/**
 * Namespace object for callers that import Random as a class-like namespace.
 * Prefer importing individual functions directly.
 */
export const Random = {
  getState,
  setState,
  fromMath,
  reset,
  next,
  float,
  int,
  bool,
  pick
};
