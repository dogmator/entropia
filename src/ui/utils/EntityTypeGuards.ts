/**
 * Module for type-safe predicates to determine entity types.
 *
 * Ensures the use of discriminated unions for guaranteed type safety during compilation.
 */

import type { Food, Obstacle, Organism } from '@/simulation/Entity';
import { EntityType } from '@/types';

/**
 * Type predicate to identify biological organisms.
 *
 * @param entity - Potential entity of unknown type
 * @returns true if the entity is an instance of Organism
 */
export function isOrganism(entity: unknown): entity is Organism {
  if (entity === null || typeof entity !== 'object') {
    return false;
  }

  const candidate = entity as Partial<Organism>;
  return (
    candidate.type === EntityType.PREY ||
    candidate.type === EntityType.PREDATOR
  );
}

/**
 * Type predicate to identify energy resources.
 *
 * @param entity - Potential entity of unknown type
 * @returns true if the entity is an instance of Food
 */
export function isFood(entity: unknown): entity is Food {
  if (entity === null || typeof entity !== 'object') {
    return false;
  }

  const candidate = entity as Partial<Food>;
  return candidate.type === EntityType.FOOD;
}

/**
 * Type predicate to identify static obstacles.
 *
 * @param entity - Potential entity of unknown type
 * @returns true if the entity is an instance of Obstacle
 */
export function isObstacle(entity: unknown): entity is Obstacle {
  if (entity === null || typeof entity !== 'object') {
    return false;
  }

  const candidate = entity as Partial<Obstacle>;
  return candidate.type === EntityType.OBSTACLE;
}

/**
 * Combined predicate to determine any entity type.
 *
 * @param entity - Potential entity of unknown type
 * @returns true if the entity is one of the recognized types
 */
export function isValidEntity(
  entity: unknown
): entity is Organism | Food | Obstacle {
  return isOrganism(entity) || isFood(entity) || isObstacle(entity);
}
