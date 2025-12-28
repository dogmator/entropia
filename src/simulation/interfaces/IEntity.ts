/**
 * Base interface for all simulation entities.
 * Provides type-safe contract for organisms, food, and obstacles.
 *
 * Benefits:
 * - Type safety through discriminated unions
 * - Easy mocking for tests
 * - Clear API contracts
 */

import type { EntityId, EntityType, MutableVector3 } from '@/types';

/**
 * Core entity interface - implemented by all simulation objects.
 */
export interface IEntity {
  /** Unique identifier */
  readonly id: EntityId;

  /** Entity type for discriminated unions */
  readonly type: EntityType;

  /** Current position in 3D space */
  position: MutableVector3;

  /** Collision radius */
  radius: number;
}

/**
 * Type guard to check if object implements IEntity.
 */
export function isEntity(obj: unknown): obj is IEntity {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'position' in obj &&
    'radius' in obj
  );
}
