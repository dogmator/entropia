/**
 * Entropia 3D — Implementation of the "Object Pool" design pattern.
 *
 * caching mechanism implementation for:
 * - Garbage Collection avoidance (minimizing GC load).
 * - Ensuring deterministic O(1) memory allocation time.
 * - High-performance reuse of particles, agents, and mathematical vectors.
 */

/**
 * Generic Object Pool.
 *
 * @template T Type parameter for object stored in the pool.
 *
 * @example
 * const particlePool = new ObjectPool(
 *   () => ({ x: 0, y: 0, z: 0, life: 1 }),
 *   (p) => { p.x = 0; p.y = 0; p.z = 0; p.life = 1; },
 *   1000
 * );
 * const particle = particlePool.acquire();
 * // ... exploit the object
 * particlePool.release(particle);
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly maxSize: number;

  private _activeCount = 0;
  private _totalCreated = 0;
  private _peakUsage = 0;

  /**
   * @param factory Delegate for instantiating a new object.
   * @param reset Function to restore object's initial state.
   * @param initialSize Pre-warming allocation volume.
   * @param maxSize Upper limit of pool capacity (default: 10000).
   */
  // eslint-disable-next-line max-params
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = POOL_CONSTANTS.DEFAULT_INITIAL_SIZE,
    maxSize: number = POOL_CONSTANTS.DEFAULT_MAX_SIZE
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Initial pre-warming of the pool with objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Acquiring an object from the pool.
   * If free units are scarce, dynamic instantiation is performed.
   */
  public acquire(): T {
    this._activeCount++;
    if (this._activeCount > this._peakUsage) {
      this._peakUsage = this._activeCount;
    }

    if (this.pool.length > 0) {
      return this.pool.pop() as T;
    }

    this._totalCreated++;
    return this.factory();
  }

  /**
   * Returning an object to the pool.
   * Reset procedure is activated for further reuse.
   */
  public release(obj: T): void {
    this._activeCount--;

    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
    // If maxSize limit is exceeded, object is subject to standard elimination (GC)
  }

  /**
   * Bulk return of object array to the pool.
   */
  public releaseAll(objects: T[]): void {
    for (const obj of objects) {
      if (obj) {
        this.release(obj);
      }
    }
  }

  /**
   * Pre-filling the pool up to specified quantitative limit.
   */
  public prewarm(count: number): void {
    const toCreate = Math.min(count - this.pool.length, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
      this._totalCreated++;
    }
  }

  /**
   * Complete destruction of pool content (relevant upon simulation reboot).
   */
  public clear(): void {
    this.pool.length = 0;
    this._activeCount = 0;
  }

  /** Number of free objects available in stack. */
  public get available(): number {
    return this.pool.length;
  }

  /** Number of objects currently in active use. */
  public get active(): number {
    return this._activeCount;
  }

  /** Maximum recorded level of concurrent usage. */
  public get peakUsage(): number {
    return this._peakUsage;
  }

  /** Cumulative number of objects created over time. */
  public get totalCreated(): number {
    return this._totalCreated;
  }

  /** Generating diagnostic report on pool state. */
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
// SPECIALIZED POOL IMPLEMENTATIONS
// ============================================================================

import type { MutableVector3 } from '@/types';

import { POOL_CONSTANTS } from '../config';

/**
 * Pool for 3D vector objects.
 * Plays critical role in minimizing allocations during physics calculations.
 */
let _vector3PoolInstance: ObjectPool<MutableVector3> | null = null;

function getVector3PoolInstance(): ObjectPool<MutableVector3> {
  _vector3PoolInstance ??= new ObjectPool<MutableVector3>(
    () => ({ x: 0, y: 0, z: 0 }),
    (v) => { v.x = 0; v.y = 0; v.z = 0; },
    POOL_CONSTANTS.VECTOR3_INITIAL_SIZE,
    POOL_CONSTANTS.VECTOR3_MAX_SIZE
  );
  return _vector3PoolInstance;
}

export const Vector3Pool = {
  getInstance: getVector3PoolInstance,
  acquire(): MutableVector3 {
    return getVector3PoolInstance().acquire();
  },
  release(v: MutableVector3): void {
    getVector3PoolInstance().release(v);
  }
};

/**
 * Public interface for particle data structures.
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
 * Pool for visual effect elements (particle systems).
 */
let _particlePoolInstance: ObjectPool<PooledParticle> | null = null;

function getParticlePoolInstance(): ObjectPool<PooledParticle> {
  _particlePoolInstance ??= new ObjectPool<PooledParticle>(
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
  return _particlePoolInstance;
}

export const ParticlePool = {
  getInstance: getParticlePoolInstance,
  acquire(): PooledParticle {
    return getParticlePoolInstance().acquire();
  },
  release(p: PooledParticle): void {
    getParticlePoolInstance().release(p);
  }
};

