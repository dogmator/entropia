/**
 * Entropia 3D — Simulation mathematical apparatus.
 *
 * Optimized computational algorithms for 3D environment:
 * - Toroidal topology (cyclic space closure).
 * - Vector algebra and radius-vector operations.
 * - Linear and non-linear interpolation algorithms.
 */

import type { MutableVector3, Vector3 } from '@/types';

import { WORLD_SIZE } from '../config';

/** Threshold below which a vector is considered zero-length (avoids division by zero). */
const NORMALIZE_EPSILON = 0.000001;
/** Smoothstep polynomial coefficient: 3 - 2t. */
const SMOOTHSTEP_A = 3;
/** Smoothstep polynomial coefficient: 3 - 2t. */
const SMOOTHSTEP_B = 2;
/** Factor used to halve a dimension for toroidal wrap checks. */
const HALF_DIVISOR = 2;
/** Reflection multiplier: reflect = v - 2*(v·n)*n. */
const REFLECT_FACTOR = 2;
/** Sphere sampling: full circle in radians divisor. */
const FULL_CIRCLE_DIVISOR = 2;
/** Sphere sampling: uniform distribution shift for phi. */
const PHI_SHIFT = 1;

/**
 * Static container class for mathematical utilities.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MathUtils {
  // ============================================================================
  // TOROIDAL GEOMETRY
  // ============================================================================

  /**
   * Wrapping coordinate to cyclic range [0, WORLD_SIZE).
   */
  public static wrap(value: number, worldSize: number = WORLD_SIZE): number {
    return ((value % worldSize) + worldSize) % worldSize;
  }

  /**
   * Vector mutation to comply with toroidal space boundaries.
   */
  public static wrapVector(v: MutableVector3, worldSize: number = WORLD_SIZE): void {
    v.x = MathUtils.wrap(v.x, worldSize);
    v.y = MathUtils.wrap(v.y, worldSize);
    v.z = MathUtils.wrap(v.z, worldSize);
  }

  /**
   * Calculating squared shortest toroidal distance between points.
   */
  public static toroidalDistanceSq(a: Vector3, b: Vector3, worldSize: number = WORLD_SIZE): number {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    let dz = Math.abs(a.z - b.z);

    const halfWorld = worldSize / HALF_DIVISOR;

    if (dx > halfWorld) { dx = worldSize - dx; }
    if (dy > halfWorld) { dy = worldSize - dy; }
    if (dz > halfWorld) { dz = worldSize - dz; }

    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Calculating shortest toroidal distance (vector magnitude).
   */
  public static toroidalDistance(a: Vector3, b: Vector3, worldSize: number = WORLD_SIZE): number {
    return Math.sqrt(MathUtils.toroidalDistanceSq(a, b, worldSize));
  }

  /**
   * Calculation of shortest difference vector considering toroidal topology.
   */
  // eslint-disable-next-line max-params
  public static toroidalVector(from: Vector3, to: Vector3, worldSize: number = WORLD_SIZE, target?: MutableVector3): MutableVector3 {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dz = to.z - from.z;

    const halfWorld = worldSize / HALF_DIVISOR;

    if (dx > halfWorld) { dx -= worldSize; }
    else if (dx < -halfWorld) { dx += worldSize; }

    if (dy > halfWorld) { dy -= worldSize; }
    else if (dy < -halfWorld) { dy += worldSize; }

    if (dz > halfWorld) { dz -= worldSize; }
    else if (dz < -halfWorld) { dz += worldSize; }

    if (target) {
      target.x = dx;
      target.y = dy;
      target.z = dz;
      return target;
    }
    return { x: dx, y: dy, z: dz };
  }

  // ============================================================================
  // VECTOR ALGEBRA (VECTOR OPERATIONS)
  // ============================================================================

  /**
   * Vector normalization (bringing to unit length).
   */
  public static normalize(v: Vector3, target?: MutableVector3): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    const res = target ?? { x: 0, y: 0, z: 0 };

    if (magSq < NORMALIZE_EPSILON) {
      res.x = 0; res.y = 0; res.z = 0;
      return res;
    }

    const mag = Math.sqrt(magSq);
    res.x = v.x / mag;
    res.y = v.y / mag;
    res.z = v.z / mag;
    return res;
  }

  /**
   * Limiting vector norm to specified maximum value (Clamping).
   */
  public static limit(v: Vector3, max: number, target?: MutableVector3): MutableVector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    const res = target ?? { x: 0, y: 0, z: 0 };

    if (magSq > max * max && magSq > 0) {
      const mag = Math.sqrt(magSq);
      const scale = max / mag;
      res.x = v.x * scale;
      res.y = v.y * scale;
      res.z = v.z * scale;
      return res;
    }

    res.x = v.x;
    res.y = v.y;
    res.z = v.z;
    return res;
  }

  /**
   * Calculating Euclidean norm (length) of a vector.
   */
  public static magnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Calculating squared norm of a vector (optimized for comparisons).
   */
  public static magnitudeSq(v: Vector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /**
   * Scalar product of two vectors.
   */
  public static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * Vector product of two vectors in 3D space.
   */
  public static cross(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Arithmetic addition of two vectors.
   */
  public static add(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Arithmetic subtraction of two vectors.
   */
  public static sub(a: Vector3, b: Vector3, target?: MutableVector3): MutableVector3 {
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = a.z - b.z;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Vector scaling by scalar value.
   */
  public static scale(v: Vector3, s: number, target?: MutableVector3): MutableVector3 {
    const x = v.x * s;
    const y = v.y * s;
    const z = v.z * s;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * In-place zero reset of all vector components.
   * Used for resetting acceleration and velocity accumulators.
   */
  public static zero(v: MutableVector3): void {
    v.x = 0;
    v.y = 0;
    v.z = 0;
  }

  // ============================================================================
  // INTERPOLATION ALGORITHMS
  // ============================================================================

  /**
   * Linear interpolation between two scalar values.
   */
  public static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Component-wise linear interpolation between two vectors.
   */
  // eslint-disable-next-line max-params
  public static lerpVector(a: Vector3, b: Vector3, t: number, target?: MutableVector3): MutableVector3 {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;

    if (target) {
      target.x = x;
      target.y = y;
      target.z = z;
      return target;
    }
    return { x, y, z };
  }

  /**
   * Smooth Hermite interpolation (Smoothstep).
   */
  public static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (SMOOTHSTEP_A - SMOOTHSTEP_B * t);
  }

  // ============================================================================
  // HELPER CALCULATIONS
  // ============================================================================

  /**
   * Clamping value in given closed interval [min, max].
   */
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Clamping value in unit interval [0, 1] (Unit Clamp / Saturate).
   * Semantic shortcut for normalized ratios and coefficients.
   */
  public static clampUnit(value: number): number {
    // eslint-disable-next-line sonarjs/no-nested-conditional
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /**
   * Linear mapping of value from one numeric range to another.
   */
  // eslint-disable-next-line max-params
  public static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  /**
   * Generating pseudorandom number in given range.
   */
  public static random(min: number, max: number): number {
    // eslint-disable-next-line sonarjs/pseudo-random
    return min + Math.random() * (max - min);
  }

  /**
   * Generating a stochastic vector uniformly distributed inside a sphere of given radius.
   */
  public static randomInSphere(radius: number): MutableVector3 {
    // eslint-disable-next-line sonarjs/pseudo-random
    const u = Math.random();
    // eslint-disable-next-line sonarjs/pseudo-random
    const v = Math.random();
    const theta = FULL_CIRCLE_DIVISOR * Math.PI * u;
    const phi = Math.acos(FULL_CIRCLE_DIVISOR * v - PHI_SHIFT);
    // eslint-disable-next-line sonarjs/pseudo-random
    const r = Math.cbrt(Math.random()) * radius;

    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    };
  }

  /**
   * Mirror reflection of a vector relative to specified surface normal.
   */
  public static reflect(incident: Vector3, normal: Vector3): MutableVector3 {
    const dot = MathUtils.dot(incident, normal);
    return {
      x: incident.x - REFLECT_FACTOR * dot * normal.x,
      y: incident.y - REFLECT_FACTOR * dot * normal.y,
      z: incident.z - REFLECT_FACTOR * dot * normal.z,
    };
  }
}
