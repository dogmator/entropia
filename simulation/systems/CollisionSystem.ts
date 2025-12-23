/**
 * Entropia 3D — Система детекції та обробки колізій (Collision System).
 *
 * Відповідає за ідентифікацію просторових перетинів об'єктів та реалізацію фізичної відповіді:
 * - Взаємодія організмів з джерелами енергії (харчування).
 * - Трофічні взаємодії (хижацтво).
 * - Пружні зіткнення зі статичними перешкодами (відбиття векторів швидкості).
 * - Моніторинг та реєстрація фактів загибелі сутностей внаслідок фізичних чинників.
 */

import { Organism, Food, Obstacle } from '../Entity';
import { EntityType, EntityId, Vector3, GridEntity } from '../../types';
import { SpatialHashGrid } from '../SpatialHashGrid';
import { MathUtils } from '../MathUtils';
import { EventBus } from '../../core/EventBus';

/**
 * Константи фізичних параметрів колізій.
 */
import { INTERACTION } from '../../constants';

/**
 * Клас, що реалізує фізику просторових взаємодій.
 */
export class CollisionSystem {
  constructor(
    private readonly spatialGrid: SpatialHashGrid,
    private readonly eventBus: EventBus
  ) { }

  /**
   * Запуск циклу ідентифікації та вирішення колізій для всієї системи.
   */
  update(
    organisms: Map<string, Organism>,
    food: Map<string, Food>,
    obstacles: Map<string, Obstacle>
  ): string[] {
    const deadOrganismIds: string[] = [];

    organisms.forEach(organism => {
      if (organism.isDead) return;

      this.handleOrganismCollisions(
        organism,
        food,
        obstacles,
        organisms,
        deadOrganismIds
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
    organisms: Map<string, Organism>,
    deadIds: string[]
  ): void {
    const searchRadius = organism.radius + 20;
    const neighbors = this.spatialGrid.getNearby(organism.position, searchRadius);

    for (const neighbor of neighbors) {
      // Виключення самоперетину
      if (neighbor.id === organism.id) continue;

      // Диференціація логіки залежно від типу об'єкта перетину
      switch (neighbor.type) {
        case EntityType.OBSTACLE:
          this.handleObstacleCollision(organism, neighbor as GridEntity, obstacles);
          break;

        case EntityType.FOOD:
          if (organism.isPrey) {
            this.handleFoodCollision(organism, neighbor as GridEntity, food);
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
   * Вирішення колізії зі статичною просторовою аномалією (перешкодою).
   */
  private handleObstacleCollision(
    organism: Organism,
    neighborEntity: GridEntity,
    obstacles: Map<string, Obstacle>
  ): void {
    const obstacle = obstacles.get(neighborEntity.id);
    if (!obstacle) return;

    if (this.isColliding(organism, obstacle)) {
      const distSq = MathUtils.toroidalDistanceSq(organism.position, neighborEntity.position);
      const minDist = organism.radius + obstacle.radius; // Restore required variable
      const dist = Math.sqrt(distSq);
      if (dist < 0.001) return; // Запобігання сингулярності (ділення на нуль)

      // Розрахунок нормувального вектора зіткнення
      const diff = MathUtils.toroidalVector(organism.position, neighborEntity.position);
      const nx = diff.x / dist;
      const ny = diff.y / dist;
      const nz = diff.z / dist;

      // Пружне відбиття вектора швидкості відносно нормалі
      const dot = organism.velocity.x * nx + organism.velocity.y * ny + organism.velocity.z * nz;
      organism.velocity.x = (organism.velocity.x - 2 * dot * nx) * INTERACTION.obstacleBounceDamping;
      organism.velocity.y = (organism.velocity.y - 2 * dot * ny) * INTERACTION.obstacleBounceDamping;
      organism.velocity.z = (organism.velocity.z - 2 * dot * nz) * INTERACTION.obstacleBounceDamping;

      // Геометрична корекція позиції для усунення перекриття об'єктів
      const overlap = minDist - dist;
      organism.position.x -= nx * overlap * INTERACTION.obstaclePushMultiplier;
      organism.position.y -= ny * overlap * INTERACTION.obstaclePushMultiplier;
      organism.position.z -= nz * overlap * INTERACTION.obstaclePushMultiplier;
    }
  }

  /**
   * Обробка взаємодії травоїдного організму з енергетичним субстратом.
   */
  private handleFoodCollision(
    organism: Organism,
    neighborEntity: GridEntity,
    food: Map<string, Food>
  ): void {
    const foodItem = food.get(neighborEntity.id);
    if (!foodItem || foodItem.consumed) return;

    if (this.isColliding(organism, foodItem)) {
      // Абсорбція енергії субстрату організмом
      organism.addEnergy(foodItem.energyValue);
      foodItem.consumed = true;
      food.delete(neighborEntity.id);

      // Генерація системної події про елімінацію ресурсу
      this.eventBus.emit({
        type: 'EntityDied',
        entityType: EntityType.FOOD,
        id: neighborEntity.id as EntityId,
        position: { ...foodItem.position },
        causeOfDeath: 'predation',
      });
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
    if (!prey || prey.isDead) return;

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
