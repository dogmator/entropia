// Magic constants for MurmurHash3-based PRNG (well-known bit-mixing constants)
const MURMURHASH_INC = 0x6d2b79f5;
const MIX_SHIFT_15 = 15;
const MIX_SHIFT_7 = 7;
const MIX_OR_61 = 61;
const MIX_SHIFT_14 = 14;
const UINT32_DIVISOR = 4294967296;
const DEFAULT_BOOL_PROBABILITY = 0.5;

/**
 * Seeded MurmurHash3-based PRNG with its own state.
 * Each simulation engine owns one stream and passes it to the code that draws from it. Two engines in one
 * JavaScript realm therefore never reset or advance each other's sequence.
 */
export class RandomStream {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public getState(): number {
    return this.state;
  }

  public setState(state: number): void {
    this.state = state >>> 0;
  }

  public reset(seed: number): void {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + MURMURHASH_INC) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> MIX_SHIFT_15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MIX_SHIFT_7), t | MIX_OR_61);
    return ((t ^ (t >>> MIX_SHIFT_14)) >>> 0) / UINT32_DIVISOR;
  }

  public float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  public int(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error('Invalid range: maxInclusive < minInclusive');
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.next() * span);
  }

  public bool(probability = DEFAULT_BOOL_PROBABILITY): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick an element from an empty array');
    }
    const index = this.int(0, items.length - 1);
    // index is guaranteed to be in [0, items.length-1]
    return items[index] as T;
  }
}
