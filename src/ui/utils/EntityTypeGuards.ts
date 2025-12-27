/**
 * Модуль типобезпечних предикатів для детермінації типів сутностей.
 *
 * Забезпечує використання дискримінаційних об'єднань (discriminated unions)
 * для гарантованої безпеки типів на етапі компіляції.
 */

import type { Food, Obstacle,Organism } from '@/simulation';
import { EntityType } from '@/types';

/**
 * Типовий предикат для ідентифікації біологічних організмів.
 *
 * @param entity - Потенційна сутність невідомого типу
 * @returns true якщо сутність є екземпляром Organism
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
 * Типовий предикат для ідентифікації енергетичних ресурсів.
 *
 * @param entity - Потенційна сутність невідомого типу
 * @returns true якщо сутність є екземпляром Food
 */
export function isFood(entity: unknown): entity is Food {
  if (entity === null || typeof entity !== 'object') {
    return false;
  }

  const candidate = entity as Partial<Food>;
  return candidate.type === EntityType.FOOD;
}

/**
 * Типовий предикат для ідентифікації статичних перешкод.
 *
 * @param entity - Потенційна сутність невідомого типу
 * @returns true якщо сутність є екземпляром Obstacle
 */
export function isObstacle(entity: unknown): entity is Obstacle {
  if (entity === null || typeof entity !== 'object') {
    return false;
  }

  const candidate = entity as Partial<Obstacle>;
  return candidate.type === EntityType.OBSTACLE;
}

/**
 * Комбінований предикат для детермінації будь-якого типу сутності.
 *
 * @param entity - Потенційна сутність невідомого типу
 * @returns true якщо сутність є одним з визнаних типів
 */
export function isValidEntity(
  entity: unknown
): entity is Organism | Food | Obstacle {
  return isOrganism(entity) || isFood(entity) || isObstacle(entity);
}
