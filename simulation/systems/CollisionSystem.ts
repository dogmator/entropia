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
import { EventBus } from '../../core/EventBus';

/**
 * Константи фізичних параметрів колізій.
 */
const OBSTACLE_BOUNCE_DAMPING = 0.8; // Коефіцієнт дисипації енергії при відбитті.
const OBSTACLE_PUSH_MULTIPLIER = 1.1; // Модифікатор сили просторової корекції (виштовхування).
const PREDATOR_ENERGY_EFFICIENCY = 0.6; // ККД засвоєння енергії хижаком при поглинанні жертви.
const MIN_ENERGY_GAIN = 25; // Гарантований мінімум енергетичного притоку при полювання.

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

    const dx = neighborEntity.position.x - organism.position.x;
    const dy = neighborEntity.position.y - organism.position.y;
    const dz = neighborEntity.position.z - organism.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    const minDist = organism.radius + obstacle.radius;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.001) return; // Запобігання сингулярності (ділення на нуль)

      // Розрахунок нормувального вектора зіткнення
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Пружне відбиття вектора швидкості відносно нормалі
      const dot = organism.velocity.x * nx + organism.velocity.y * ny + organism.velocity.z * nz;
      organism.velocity.x = (organism.velocity.x - 2 * dot * nx) * OBSTACLE_BOUNCE_DAMPING;
      organism.velocity.y = (organism.velocity.y - 2 * dot * ny) * OBSTACLE_BOUNCE_DAMPING;
      organism.velocity.z = (organism.velocity.z - 2 * dot * nz) * OBSTACLE_BOUNCE_DAMPING;

      // Геометрична корекція позиції для усунення перекриття об'єктів
      const overlap = minDist - dist;
      organism.position.x -= nx * overlap * OBSTACLE_PUSH_MULTIPLIER;
      organism.position.y -= ny * overlap * OBSTACLE_PUSH_MULTIPLIER;
      organism.position.z -= nz * overlap * OBSTACLE_PUSH_MULTIPLIER;
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

    const dx = neighborEntity.position.x - organism.position.x;
    const dy = neighborEntity.position.y - organism.position.y;
    const dz = neighborEntity.position.z - organism.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    const minDist = organism.radius + foodItem.radius;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
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

    const dx = preyEntity.position.x - predator.position.x;
    const dy = preyEntity.position.y - predator.position.y;
    const dz = preyEntity.position.z - predator.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    const minDist = predator.radius + prey.radius;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
      // Розрахунок енергетичного прибутку на основі стану жертви
      const energyGain = Math.max(
        MIN_ENERGY_GAIN,
        prey.energy * PREDATOR_ENERGY_EFFICIENCY
      );

      predator.addEnergy(energyGain);
      predator.huntSuccessCount++;

      // Термінація життєвого циклу жертви
      prey.die('predation');
      deadIds.push(prey.id);
    }
  }

  /**
   * Допоміжний метод для геометричної перевірки перетину двох сфер.
   */
  private checkSphereCollision(
    pos1: Vector3,
    radius1: number,
    pos2: Vector3,
    radius2: number
  ): boolean {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const minDist = radius1 + radius2;
    return distSq < minDist * minDist;
  }

  /**
   * Математичний розрахунок вектора ідеального дзеркального відбиття.
   */
  private calculateReflection(
    velocity: Vector3,
    normal: Vector3
  ): Vector3 {
    const dot = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
    return {
      x: velocity.x - 2 * dot * normal.x,
      y: velocity.y - 2 * dot * normal.y,
      z: velocity.z - 2 * dot * normal.z,
    };
  }
}
