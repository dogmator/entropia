/**
 * Entropia 3D — Реалізація патерна проєктування «Object Pool» (Пул об'єктів).
 *
 * Імплементація механізму кешування об'єктів для:
 * - Мінімізації навантаження на складальник сміття (Garbage Collection avoidance).
 * - Забезпечення детермінованого часу виділення пам'яті O(1).
 * - Високопродуктивного перевикористання часток, агентів та математичних векторів.
 */

/**
 * Універсальний типізований Пул Об'єктів (Generic Object Pool).
 *
 * @template T Типовий параметр об'єкта, що зберігається в пулі.
 *
 * @example
 * const particlePool = new ObjectPool(
 *   () => ({ x: 0, y: 0, z: 0, life: 1 }),
 *   (p) => { p.x = 0; p.y = 0; p.z = 0; p.life = 1; },
 *   1000
 * );
 * const particle = particlePool.acquire();
 * // ... експлуатація об'єкта
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
   * @param factory Делегат для інстанціації нового об'єкта.
   * @param reset Функція для відновлення первинного стану об'єкта.
   * @param initialSize Обсяг превентивного виділення пам'яті (преварінг).
   * @param maxSize Верхня межа місткості пулу (дефолт: 10000).
   */
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = POOL_CONSTANTS.DEFAULT_INITIAL_SIZE,
    maxSize: number = POOL_CONSTANTS.DEFAULT_MAX_SIZE
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Початкове превентивне наповнення пулу об'єктами
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Отримання об'єкта з пулу.
   * У разі дефіциту вільних одиниць виконується динамічна інстанціація.
   */
  public acquire(): T {
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
   * Повернення об'єкта до пулу.
   * Активується процедура очищення (reset) для подальшого перевикористання.
   */
  public release(obj: T): void {
    this._activeCount--;

    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
    // При перевищенні ліміту maxSize об'єкт підлягає стандартній елімінації (GC)
  }

  /**
   * Масове повернення масиву об'єктів до пулу.
   */
  public releaseAll(objects: T[]): void {
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (obj) {
        this.release(obj);
      }
    }
  }

  /**
   * Передчасне наповнення пулу до заданої кількісної межі.
   */
  public prewarm(count: number): void {
    const toCreate = Math.min(count - this.pool.length, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Повна деструкція вмісту пулу (актуально при ребуті симуляції).
   */
  public clear(): void {
    this.pool.length = 0;
    this._activeCount = 0;
  }

  /** Кількість вільних об'єктів, доступних у стеку. */
  public get available(): number {
    return this.pool.length;
  }

  /** Кількість об'єктів, що перебувають в активній експлуатації. */
  public get active(): number {
    return this._activeCount;
  }

  /** Максимальний зафіксований рівень одночасного використання. */
  public get peakUsage(): number {
    return this._peakUsage;
  }

  /** Кумулятивна кількість створених за весь час об'єктів. */
  public get totalCreated(): number {
    return this._totalCreated;
  }

  /** Формування діагностичного звіту про стан пулу. */
  public getStats(): PoolStats {
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
// СПЕЦІАЛІЗОВАНІ РЕАЛІЗАЦІЇ ПУЛІВ
// ============================================================================

import type { MutableVector3 } from '@/types';
import { vec3Zero } from '@/types';

import { POOL_CONSTANTS } from '../constants';

/**
 * Пул для об'єктів тривимірних векторів.
 * Відіграє критичну роль у мінімізації алокацій при фізичних розрахунках.
 */
export class Vector3Pool {
  private static instance: ObjectPool<MutableVector3> | null = null;

  public static getInstance(): ObjectPool<MutableVector3> {
    if (!Vector3Pool.instance) {
      Vector3Pool.instance = new ObjectPool<MutableVector3>(
        () => vec3Zero(),
        (v) => { v.x = 0; v.y = 0; v.z = 0; },
        POOL_CONSTANTS.VECTOR3_INITIAL_SIZE,
        POOL_CONSTANTS.VECTOR3_MAX_SIZE
      );
    }
    return Vector3Pool.instance;
  }

  public static acquire(): MutableVector3 {
    return Vector3Pool.getInstance().acquire();
  }

  public static release(v: MutableVector3): void {
    Vector3Pool.getInstance().release(v);
  }
}

/**
 * Програмний інтерфейс для структур даних частинок.
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
 * Пул для елементів візуальних ефектів (систем часток).
 */
export class ParticlePool {
  private static instance: ObjectPool<PooledParticle> | null = null;

  public static getInstance(): ObjectPool<PooledParticle> {
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
        POOL_CONSTANTS.PARTICLE_INITIAL_SIZE,
        POOL_CONSTANTS.PARTICLE_MAX_SIZE
      );
    }
    return ParticlePool.instance;
  }

  public static acquire(): PooledParticle {
    return ParticlePool.getInstance().acquire();
  }

  public static release(p: PooledParticle): void {
    ParticlePool.getInstance().release(p);
  }
}

/**
 * Кільцевий буфер (Ring Buffer) для зберігання хронологічних даних популяції.
 * Забезпечує сталу складність O(1) для операцій запису.
 */
export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head: number = 0;
  private _size: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  /** Додавання нового елемента з потенційним заміщенням найстарішого. */
  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  /** Доступ до елемента за логічним індексом. */
  public get(index: number): T | undefined {
    if (index < 0 || index >= this._size) { return undefined; }
    const actualIndex = (this.head - this._size + index + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  public get size(): number {
    return this._size;
  }

  public get isFull(): boolean {
    return this._size === this.capacity;
  }

  /** Перетворення буфера у лінійний масив даних. */
  public toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /** Повне анулювання вмісту буфера. */
  public clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this._size = 0;
  }

  /** Екстракція останніх N записів зі сховища. */
  public getLast(n: number): T[] {
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
