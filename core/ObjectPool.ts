
/**
 * EVOSIM 3D — Object Pool Pattern
 *
 * Академически корректная реализация пула объектов для:
 * - Нулевого garbage collection во время симуляции
 * - Предсказуемого времени выделения памяти O(1)
 * - Эффективного переиспользования частиц, организмов и векторов
 */

/**
 * Generic Object Pool с типизацией
 *
 * @template T Тип объекта в пуле
 *
 * @example
 * const particlePool = new ObjectPool(
 *   () => ({ x: 0, y: 0, z: 0, life: 1 }),
 *   (p) => { p.x = 0; p.y = 0; p.z = 0; p.life = 1; },
 *   1000
 * );
 * const particle = particlePool.acquire();
 * // ... use particle
 * particlePool.release(particle);
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly maxSize: number;

  private _activeCount: number = 0;
  private _totalCreated: number = 0;
  private _peakUsage: number = 0;

  /**
   * @param factory Функция создания нового объекта
   * @param reset Функция сброса объекта в начальное состояние
   * @param initialSize Начальный размер пула
   * @param maxSize Максимальный размер пула (по умолчанию 10000)
   */
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 100,
    maxSize: number = 10000
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Получить объект из пула
   * Если пул пуст — создаётся новый объект
   */
  acquire(): T {
    this._activeCount++;
    if (this._activeCount > this._peakUsage) {
      this._peakUsage = this._activeCount;
    }

    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    this._totalCreated++;
    return this.factory();
  }

  /**
   * Вернуть объект в пул
   * Объект сбрасывается и становится доступным для повторного использования
   */
  release(obj: T): void {
    this._activeCount--;

    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
    // Если пул переполнен, объект просто отбрасывается
  }

  /**
   * Вернуть массив объектов в пул
   */
  releaseAll(objects: T[]): void {
    for (let i = 0; i < objects.length; i++) {
      this.release(objects[i]);
    }
  }

  /**
   * Предварительно создать объекты до указанного количества
   */
  prewarm(count: number): void {
    const toCreate = Math.min(count - this.pool.length, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Очистить пул (для полной перезагрузки)
   */
  clear(): void {
    this.pool.length = 0;
    this._activeCount = 0;
  }

  /** Количество объектов, доступных в пуле */
  get available(): number {
    return this.pool.length;
  }

  /** Количество объектов, используемых в данный момент */
  get active(): number {
    return this._activeCount;
  }

  /** Пиковое использование за всё время */
  get peakUsage(): number {
    return this._peakUsage;
  }

  /** Всего создано объектов */
  get totalCreated(): number {
    return this._totalCreated;
  }

  /** Статистика пула для отладки */
  getStats(): PoolStats {
    return {
      available: this.pool.length,
      active: this._activeCount,
      peakUsage: this._peakUsage,
      totalCreated: this._totalCreated,
      maxSize: this.maxSize,
    };
  }
}

export interface PoolStats {
  readonly available: number;
  readonly active: number;
  readonly peakUsage: number;
  readonly totalCreated: number;
  readonly maxSize: number;
}

// ============================================================================
// SPECIALIZED POOLS
// ============================================================================

import { MutableVector3, vec3Zero } from '../types';

/**
 * Пул для 3D векторов
 * Критически важен для физических вычислений
 */
export class Vector3Pool {
  private static instance: ObjectPool<MutableVector3> | null = null;

  static getInstance(): ObjectPool<MutableVector3> {
    if (!Vector3Pool.instance) {
      Vector3Pool.instance = new ObjectPool<MutableVector3>(
        () => vec3Zero(),
        (v) => { v.x = 0; v.y = 0; v.z = 0; },
        500,
        5000
      );
    }
    return Vector3Pool.instance;
  }

  static acquire(): MutableVector3 {
    return Vector3Pool.getInstance().acquire();
  }

  static release(v: MutableVector3): void {
    Vector3Pool.getInstance().release(v);
  }
}

/**
 * Интерфейс для объектов частиц
 */
export interface PooledParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  opacity: number;
}

/**
 * Пул для частиц визуальных эффектов
 */
export class ParticlePool {
  private static instance: ObjectPool<PooledParticle> | null = null;

  static getInstance(): ObjectPool<PooledParticle> {
    if (!ParticlePool.instance) {
      ParticlePool.instance = new ObjectPool<PooledParticle>(
        () => ({
          x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0,
          life: 0, maxLife: 1,
          size: 1, color: 0xffffff, opacity: 1
        }),
        (p) => {
          p.x = 0; p.y = 0; p.z = 0;
          p.vx = 0; p.vy = 0; p.vz = 0;
          p.life = 0; p.maxLife = 1;
          p.size = 1; p.color = 0xffffff; p.opacity = 1;
        },
        2000,
        20000
      );
    }
    return ParticlePool.instance;
  }

  static acquire(): PooledParticle {
    return ParticlePool.getInstance().acquire();
  }

  static release(p: PooledParticle): void {
    ParticlePool.getInstance().release(p);
  }
}

/**
 * Ring Buffer для истории популяции
 * Фиксированный размер, O(1) добавление
 */
export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head: number = 0;
  private _size: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this._size) return undefined;
    const actualIndex = (this.head - this._size + index + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  get size(): number {
    return this._size;
  }

  get isFull(): boolean {
    return this._size === this.capacity;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this._size = 0;
  }

  /** Получить последние N элементов */
  getLast(n: number): T[] {
    const count = Math.min(n, this._size);
    const result: T[] = [];
    for (let i = this._size - count; i < this._size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }
}
