/**
 * Entropia 3D — Physical dynamics modeling system (Physics System).
 *
 * Responsible for kinematic analysis and integrating equations of motion for biological agents:
 * - Velocity vector calculation based on accumulated acceleration.
 * - Dynamic velocity limiting according to organism's genetic potential.
 * - Spatial coordinate updates considering toroidal world topology.
 * - Modeling hydrodynamic drag forces.
 */

import type { MutableVector3, WorldConfig } from '@/types';

import type { Organism } from '../Entity';
import { MathUtils } from '../MathUtils.utils';

/**
 * Constants for physical model parameters.
 */
const MAX_STEERING_FORCE = 50;
/** Absolute upper speed limit (independent of genome). */
const HARD_MAX_SPEED = 3.0;
/** Coefficient for kinetic energy formula E = 0.5 * m * v². */
const KINETIC_ENERGY_HALF = 0.5;

/**
 * Class implementing the simulation's physical engine.
 */
export class PhysicsSystem {
  constructor(
    private readonly worldConfig: WorldConfig
  ) { }

  /**
   * Physical state update for the entire population.
   */
  public update(organisms: Map<string, Organism>): void {
    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.integrate(organism);
      }
    });
  }

  /**
   * Performing numerical integration iteration for a single object.
   */
  private integrate(org: Organism): void {
    // 1. Limiting the resulting acceleration force
    this.limitAcceleration(org);

    // 2. Incremental velocity vector update
    this.updateVelocity(org);

    // 3. Velocity normalization according to genetic potential
    this.limitVelocity(org);

    // Validation: Check for NaN velocity
    if (Number.isNaN(org.velocity.x) || Number.isNaN(org.velocity.y) || Number.isNaN(org.velocity.z)) {
      console.error(`PhysicsSystem: NaN velocity detected for organism ${org.id}`);
      MathUtils.zero(org.velocity);
    }

    // 4. Position translation in toroidal space
    this.updatePosition(org);

    // 5. Modeling energy dissipation through environmental resistance
    this.applyDrag(org);

    // 6. Acceleration accumulator reset for next iteration cycle
    this.resetAcceleration(org);
  }

  /**
   * Limiting acceleration vector magnitude (determining physical force limit).
   */
  private limitAcceleration(org: Organism): void {
    this.limitVector(org.acceleration, MAX_STEERING_FORCE);
  }

  /**
   * Updating velocity vector based on current force (acceleration).
   */
  private updateVelocity(org: Organism): void {
    org.velocity.x += org.acceleration.x;
    org.velocity.y += org.acceleration.y;
    org.velocity.z += org.acceleration.z;
  }

  /**
   * Speed regulation according to individual organism characteristics.
   */
  private limitVelocity(org: Organism): void {
    // Hard cap max speed to HARD_MAX_SPEED effectively as requested
    const effectiveMaxSpeed = Math.min(org.genome.maxSpeed, HARD_MAX_SPEED);
    this.limitVector(org.velocity, effectiveMaxSpeed);
  }

  /**
   * Universal helper for limiting vector magnitude.
   */
  private limitVector(v: MutableVector3, max: number): void {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq > max * max && magSq > 0) {
      const scale = max / Math.sqrt(magSq);
      v.x *= scale;
      v.y *= scale;
      v.z *= scale;
    }
  }

  /**
   * Updating spatial coordinates with toroidal boundary verification.
   */
  private updatePosition(org: Organism): void {
    const ws = this.worldConfig.WORLD_SIZE;
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x, ws);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y, ws);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z, ws);
  }

  /**
   * Applying environment linear friction constant.
   */
  private applyDrag(org: Organism): void {
    const DRAG_COEFFICIENT = 0.96;
    org.velocity.x *= DRAG_COEFFICIENT;
    org.velocity.y *= DRAG_COEFFICIENT;
    org.velocity.z *= DRAG_COEFFICIENT;
  }

  /**
   * Zeroing force vector to prepare for a new calculation cycle.
   */
  private resetAcceleration(org: Organism): void {
    MathUtils.zero(org.acceleration);
  }

  /**
   * Current agent kinetic energy calculation.
   */
  public getKineticEnergy(org: Organism): number {
    const speedSq =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    // E = 0.5 * m * v^2 (where m is equivalent to genome size parameter)
    return KINETIC_ENERGY_HALF * org.genome.size * speedSq;
  }
}
