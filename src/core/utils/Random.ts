export class Random {
  private static state: number;

  constructor(seed: number) {
    Random.state = seed >>> 0;
  }

  public static getState(): number {
    return Random.state;
  }

  public static setState(state: number): void {
    Random.state = state >>> 0;
  }

  public static fromMath(): void {
    Random.state = (Math.random() * 0xffffffff) >>> 0;
  }

  public static reset(seed: number): void {
    Random.state = seed >>> 0;
  }

  public static next(): number {
    Random.state = (Random.state + 0x6d2b79f5) >>> 0;
    let t = Random.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public static float(min: number, max: number): number {
    return min + (max - min) * Random.next();
  }

  public static int(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error('Некоректний діапазон: maxInclusive < minInclusive');
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(Random.next() * span);
  }

  public static bool(probability: number = 0.5): boolean {
    return Random.next() < probability;
  }

  public static pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Неможливо обрати елемент з порожнього масиву');
    }
    return items[Random.int(0, items.length - 1)]!;
  }
}
