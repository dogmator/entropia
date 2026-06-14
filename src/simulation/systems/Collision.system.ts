/**
 * Entropia 3D — Collision detection and processing system (Collision System).
 *
 * Responsible for identifying spatial intersections of objects and implementing physical response:
 * - Interaction of organisms with energy sources (feeding).
 * - Trophic interactions (predation).
 * - Elastic collisions with static obstacles (reflection of velocity vectors).
 * - Monitoring and registering facts of entity death due to physical factors.
 */

/**
 * Constants for physical collision parameters.
 */
import { ENTITY_CONSTANTS, INTERACTION, PHYSICS } from '@/config';
import type { EventBus } from '@/core';
import { logger } from '@/core';
import { Vector3Pool } from '@/core/ObjectPool.service';
import { Random } from '@/core/utils/Random.utils';
import type { EcologicalZone, GridEntity, Vector3 } from '@/types';
import type { WorldConfig } from '@/types';
import { EntityType } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import type { GridManager } from '../managers/GridManager.manager';
import { MathUtils } from '../MathUtils.utils';

/** Dot-product coefficient for reflection: reflect = v - 2*(v·n)*n */
const REFLECT_DOT_FACTOR = 2;
/** Midpoint factor used for stuck-release impulse centring. */
const STUCK_RELEASE_CENTER = 0.5;

/**
 * Class implementing physical spatial interactions.
 */
export class CollisionSystem {
  /** Cached neighbors buffer to avoid allocations. */
  private readonly nearbyBuffer: GridEntity[] = [];

  constructor(
    private readonly gridManager: GridManager,
    private readonly eventBus: EventBus,
    private readonly worldConfig: WorldConfig
  ) { }

  /**
   * Launching identification and resolution cycle for the entire system.
   */
  // eslint-disable-next-line max-params
  public update(
    organisms: Map<string, Organism>,
    food: Map<string, Food>,
    obstacles: Map<string, Obstacle>,
    zones: Map<string, EcologicalZone>,
    tick: number
  ): string[] {
    const deadOrganismIds: string[] = [];

    organisms.forEach(organism => {
      if (organism.isDead) { return; }

      this.handleOrganismCollisions(
        organism,
        food,
        obstacles,
        zones,
        organisms,
        deadOrganismIds,
        tick
      );
    });

    return deadOrganismIds;
  }

  /**
   * Personal environment processing for a specific organism.
   */
  // eslint-disable-next-line max-params
  private handleOrganismCollisions(
    organism: Organism,
    food: Map<string, Food>,
    obstacles: Map<string, Obstacle>,
    zones: Map<string, EcologicalZone>,
    organisms: Map<string, Organism>,
    deadIds: string[],
    tick: number
  ): void {
    const isFrozenInsideAnomaly = this.handleZoneCollisions(organism, zones);
    if (isFrozenInsideAnomaly) {
      return;
    }

    const searchRadius = organism.radius + PHYSICS.COLLISION_SEARCH_RADIUS_OFFSET;

    // Using cached buffer
    this.gridManager.getNearby(organism.position, searchRadius, this.nearbyBuffer);
    const neighbors = this.nearbyBuffer;

    for (const neighbor of neighbors) {
      // Exclude self-intersection
      if (neighbor.id === organism.id) { continue; }

      // Logic differentiation based on intersection object type
      switch (neighbor.type) {
        case EntityType.OBSTACLE:
          this.handleObstacleCollision(organism, neighbor, obstacles);
          break;

        case EntityType.FOOD:
          if (organism.isPrey) {
            this.handleFoodCollision(organism, neighbor, food, tick);
          }
          break;

        case EntityType.PREY:
          if (organism.isPredator) {
            this.handlePredationCollision(organism, neighbor, organisms, deadIds);
          }
          break;

        case EntityType.PREDATOR:
          // Predator-predator collisions are not handled
          break;
      }
    }
  }

  /**
   * Handling interaction with spatial anomalies (ecological spheres).
   */
  private handleZoneCollisions(
    organism: Organism,
    zones: Map<string, EcologicalZone>
  ): boolean {
    for (const zone of zones.values()) {
      const distSq = MathUtils.toroidalDistanceSq(organism.position, zone.center, this.worldConfig.WORLD_SIZE);
      const dist = Math.sqrt(distSq);
      const fullyInsideThreshold = Math.max(0, zone.radius - organism.radius);

      if (dist < fullyInsideThreshold) {
        MathUtils.zero(organism.velocity);
        MathUtils.zero(organism.acceleration);
        organism.stuckTicks = 0;
        return true;
      }

      if (dist < zone.radius + organism.radius) {
        this.resolveSphericalBarrierCollision(organism, zone.center, zone.radius);
      }
    }

    return false;
  }

  /**
   * Resolving collision with static spatial anomaly (obstacle).
   */
  private handleObstacleCollision(
    organism: Organism,
    neighborEntity: GridEntity,
    obstacles: Map<string, Obstacle>
  ): void {
    const obstacle = obstacles.get(neighborEntity.id);
    if (!obstacle) { return; }

    if (this.isColliding(organism, obstacle)) {
      this.resolveSphericalBarrierCollision(organism, neighborEntity.position, obstacle.radius);
    }
  }

  private resolveSphericalBarrierCollision(
    organism: Organism,
    center: Vector3,
    barrierRadius: number
  ): void {
    const distSq = MathUtils.toroidalDistanceSq(organism.position, center, this.worldConfig.WORLD_SIZE);
    const minDist = organism.radius + barrierRadius;
    const dist = Math.sqrt(distSq);
    if (dist < PHYSICS.EPSILON) { return; }

    const diff = Vector3Pool.acquire();
    MathUtils.toroidalVector(organism.position, center, this.worldConfig.WORLD_SIZE, diff);
    const nx = diff.x / dist;
    const ny = diff.y / dist;
    const nz = diff.z / dist;
    Vector3Pool.release(diff);

    const dot = organism.velocity.x * nx + organism.velocity.y * ny + organism.velocity.z * nz;

    const tangentX = organism.velocity.x - dot * nx;
    const tangentY = organism.velocity.y - dot * ny;
    const tangentZ = organism.velocity.z - dot * nz;
    const tangentMagnitudeSq = tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ;

    if (tangentMagnitudeSq > PHYSICS.EPSILON * PHYSICS.EPSILON) {
      organism.velocity.x = tangentX * INTERACTION.obstacleSlideRetention;
      organism.velocity.y = tangentY * INTERACTION.obstacleSlideRetention;
      organism.velocity.z = tangentZ * INTERACTION.obstacleSlideRetention;
    } else {
      this.applyBounceVelocity(organism, { dot, nx, ny, nz });
    }

    this.applyStuckResolution(organism);

    const overlap = minDist - dist;
    organism.position.x -= nx * overlap * INTERACTION.obstaclePushMultiplier;
    organism.position.y -= ny * overlap * INTERACTION.obstaclePushMultiplier;
    organism.position.z -= nz * overlap * INTERACTION.obstaclePushMultiplier;
  }

  private applyBounceVelocity(
    organism: Organism,
    opts: { dot: number, nx: number, ny: number, nz: number }
  ): void {
    const { dot, nx, ny, nz } = opts;
    organism.velocity.x = (organism.velocity.x - REFLECT_DOT_FACTOR * dot * nx) * INTERACTION.obstacleBounceDamping;
    organism.velocity.y = (organism.velocity.y - REFLECT_DOT_FACTOR * dot * ny) * INTERACTION.obstacleBounceDamping;
    organism.velocity.z = (organism.velocity.z - REFLECT_DOT_FACTOR * dot * nz) * INTERACTION.obstacleBounceDamping;

    organism.velocity.x -= nx * INTERACTION.obstacleFallbackReflectImpulse;
    organism.velocity.y -= ny * INTERACTION.obstacleFallbackReflectImpulse;
    organism.velocity.z -= nz * INTERACTION.obstacleFallbackReflectImpulse;
  }

  private applyStuckResolution(organism: Organism): void {
    const postSpeedSq =
      organism.velocity.x * organism.velocity.x +
      organism.velocity.y * organism.velocity.y +
      organism.velocity.z * organism.velocity.z;

    if (postSpeedSq < INTERACTION.obstacleMinSlideSpeed * INTERACTION.obstacleMinSlideSpeed) {
      organism.stuckTicks += 1;
      if (organism.stuckTicks >= ENTITY_CONSTANTS.STUCK_TICKS_THRESHOLD) {
        organism.velocity.x += (Random.next() - STUCK_RELEASE_CENTER) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.velocity.y += (Random.next() - STUCK_RELEASE_CENTER) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.velocity.z += (Random.next() - STUCK_RELEASE_CENTER) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.stuckTicks = 0;
      }
    } else {
      organism.stuckTicks = 0;
    }
  }

  /**
   * Handling herbivore organism interaction with energy substrate.
   */
  // eslint-disable-next-line max-params
  private handleFoodCollision(
    organism: Organism,
    neighborEntity: GridEntity,
    food: Map<string, Food>,
    tick: number
  ): void {
    const foodItem = food.get(neighborEntity.id);
    if (!foodItem || foodItem.consumed) { return; }

    if (this.isColliding(organism, foodItem)) {
      const radiusBefore = foodItem.radius;
      const absorbedEnergy = foodItem.applyBite(ENTITY_CONSTANTS.FOOD_BITE_ENERGY, tick);
      organism.addEnergy(absorbedEnergy);
      if (absorbedEnergy > 0 && tick % 60 === 0) {
        logger.debug(`Food bite: id=${foodItem.id} r ${String(radiusBefore.toFixed(2))}→${String(foodItem.radius.toFixed(2))} energy=${String(foodItem.currentEnergy.toFixed(1))} absorbed=${String(absorbedEnergy.toFixed(1))}`, 'CollisionSystem');
      }

      // applyBite may set foodItem.consumed; check the field via an unnarrowed reference
      const ref: { consumed: boolean } = foodItem;
      if (ref.consumed) {
        food.delete(neighborEntity.id);

        // System event generation for resource elimination
        this.eventBus.emit({
          type: 'EntityDied',
          entityType: EntityType.FOOD,
          id: neighborEntity.id,
          position: { x: foodItem.position.x, y: foodItem.position.y, z: foodItem.position.z },
          causeOfDeath: 'predation',
        });
      }
    }
  }

  /**
   * Handling predation act between consumers of different levels.
   */
  // eslint-disable-next-line max-params
  private handlePredationCollision(
    predator: Organism,
    preyEntity: GridEntity,
    organisms: Map<string, Organism>,
    deadIds: string[]
  ): void {
    const prey = organisms.get(preyEntity.id);
    if (!prey || prey.isDead) { return; }

    if (this.isColliding(predator, prey)) {
      // Calculation of energy gain based on prey state
      const energyGain = Math.max(
        INTERACTION.minEnergyGain,
        prey.energy * INTERACTION.predatorEnergyEfficiency
      );

      predator.addEnergy(energyGain);
      predator.huntSuccessCount++;

      // Termination of prey life cycle
      prey.die('predation');
      deadIds.push(prey.id);
    }
  }

  /**
   * Unified check for physical intersection of two objects.
   */
  private isColliding(a: { position: Vector3, radius: number }, b: { position: Vector3, radius: number }): boolean {
    const distSq = MathUtils.toroidalDistanceSq(a.position, b.position);
    const minDist = a.radius + b.radius;
    return distSq < minDist * minDist;
  }
}
