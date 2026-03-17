/**
 * Entropia 3D — Система детекції та обробки колізій (Collision System).
 *
 * Відповідає за ідентифікацію просторових перетинів об'єктів та реалізацію фізичної відповіді:
 * - Взаємодія організмів з джерелами енергії (харчування).
 * - Трофічні взаємодії (хижацтво).
 * - Пружні зіткнення зі статичними перешкодами (відбиття векторів швидкості).
 * - Моніторинг та реєстрація фактів загибелі сутностей внаслідок фізичних чинників.
 */

/**
 * Константи фізичних параметрів колізій.
 */
import { ENTITY_CONSTANTS, INTERACTION, PHYSICS } from '@/config';
import type { EventBus } from '@/core';
import { Vector3Pool } from '@/core/ObjectPool';
import { Random } from '@/core/utils/Random';
import type { EcologicalZone, EntityId, GridEntity, Vector3 } from '@/types';
import type { WorldConfig } from '@/types';
import { EntityType } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import type { GridManager } from '../managers/GridManager';
import { MathUtils } from '../MathUtils';

/**
 * Клас, що реалізує фізику просторових взаємодій.
 */
export class CollisionSystem {
  /** Кешований буфер сусідів для уникнення алокацій. */
  private readonly nearbyBuffer: GridEntity[] = [];

  constructor(
    private readonly gridManager: GridManager,
    private readonly eventBus: EventBus,
    private readonly worldConfig: WorldConfig
  ) { }

  /**
   * Запуск циклу ідентифікації та вирішення колізій для всієї системи.
   */
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
   * Персональна обробка оточення для конкретного організму.
   */
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

    // Використання кешованого буфера
    this.gridManager.getNearby(organism.position, searchRadius, this.nearbyBuffer);
    const neighbors = this.nearbyBuffer;

    for (const neighbor of neighbors) {
      // Виключення самоперетину
      if (neighbor.id === organism.id) { continue; }

      // Диференціація логіки залежно від типу об'єкта перетину
      switch (neighbor.type) {
        case EntityType.OBSTACLE:
          this.handleObstacleCollision(organism, neighbor as GridEntity, obstacles);
          break;

        case EntityType.FOOD:
          if (organism.isPrey) {
            this.handleFoodCollision(organism, neighbor as GridEntity, food, tick);
          }
          break;

        case EntityType.PREY:
          if (organism.isPredator) {
            this.handlePredationCollision(organism, neighbor as GridEntity, organisms, deadIds);
          }
          break;
      }
    }
  }

  /**
   * Обробка взаємодії з просторовими аномаліями (екологічними сферами).
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
        organism.velocity.x = 0;
        organism.velocity.y = 0;
        organism.velocity.z = 0;
        organism.acceleration.x = 0;
        organism.acceleration.y = 0;
        organism.acceleration.z = 0;
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
   * Вирішення колізії зі статичною просторовою аномалією (перешкодою).
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
      organism.velocity.x = (organism.velocity.x - 2 * dot * nx) * INTERACTION.obstacleBounceDamping;
      organism.velocity.y = (organism.velocity.y - 2 * dot * ny) * INTERACTION.obstacleBounceDamping;
      organism.velocity.z = (organism.velocity.z - 2 * dot * nz) * INTERACTION.obstacleBounceDamping;

      organism.velocity.x -= nx * INTERACTION.obstacleFallbackReflectImpulse;
      organism.velocity.y -= ny * INTERACTION.obstacleFallbackReflectImpulse;
      organism.velocity.z -= nz * INTERACTION.obstacleFallbackReflectImpulse;
    }

    const postSpeedSq =
      organism.velocity.x * organism.velocity.x +
      organism.velocity.y * organism.velocity.y +
      organism.velocity.z * organism.velocity.z;
    if (postSpeedSq < INTERACTION.obstacleMinSlideSpeed * INTERACTION.obstacleMinSlideSpeed) {
      organism.stuckTicks += 1;
      if (organism.stuckTicks >= ENTITY_CONSTANTS.STUCK_TICKS_THRESHOLD) {
        organism.velocity.x += (Random.next() - 0.5) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.velocity.y += (Random.next() - 0.5) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.velocity.z += (Random.next() - 0.5) * ENTITY_CONSTANTS.STUCK_RELEASE_IMPULSE;
        organism.stuckTicks = 0;
      }
    } else {
      organism.stuckTicks = 0;
    }

    const overlap = minDist - dist;
    organism.position.x -= nx * overlap * INTERACTION.obstaclePushMultiplier;
    organism.position.y -= ny * overlap * INTERACTION.obstaclePushMultiplier;
    organism.position.z -= nz * overlap * INTERACTION.obstaclePushMultiplier;
  }

  /**
   * Обробка взаємодії травоїдного організму з енергетичним субстратом.
   */
  private handleFoodCollision(
    organism: Organism,
    neighborEntity: GridEntity,
    food: Map<string, Food>,
    tick: number
  ): void {
    const foodItem = food.get(neighborEntity.id);
    if (!foodItem || foodItem.consumed) { return; }

    if (this.isColliding(organism, foodItem)) {
      const absorbedEnergy = foodItem.applyBite(ENTITY_CONSTANTS.FOOD_BITE_ENERGY, tick);
      organism.addEnergy(absorbedEnergy);

      if (foodItem.consumed) {
        food.delete(neighborEntity.id);

        // Генерація системної події про елімінацію ресурсу
        this.eventBus.emit({
          type: 'EntityDied',
          entityType: EntityType.FOOD,
          id: neighborEntity.id as EntityId,
          position: { x: foodItem.position.x, y: foodItem.position.y, z: foodItem.position.z },
          causeOfDeath: 'predation',
        });
      }
    }
  }

  /**
   * Обробка акту хижацтва між консументами різних рівнів.
   */
  private handlePredationCollision(
    predator: Organism,
    preyEntity: GridEntity,
    organisms: Map<string, Organism>,
    deadIds: string[]
  ): void {
    const prey = organisms.get(preyEntity.id);
    if (!prey || prey.isDead) { return; }

    if (this.isColliding(predator, prey)) {
      // Розрахунок енергетичного прибутку на основі стану жертви
      const energyGain = Math.max(
        INTERACTION.minEnergyGain,
        prey.energy * INTERACTION.predatorEnergyEfficiency
      );

      predator.addEnergy(energyGain);
      predator.huntSuccessCount++;

      // Термінація життєвого циклу жертви
      prey.die('predation');
      deadIds.push(prey.id);
    }
  }

  /**
   * Уніфікована перевірка на фізичний перетин двох об'єктів.
   */
  private isColliding(a: { position: Vector3, radius: number }, b: { position: Vector3, radius: number }): boolean {
    const distSq = MathUtils.toroidalDistanceSq(a.position, b.position);
    const minDist = a.radius + b.radius;
    return distSq < minDist * minDist;
  }
}
