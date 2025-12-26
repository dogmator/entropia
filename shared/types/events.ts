/**
 * Entropia 3D — Типи системи подій.
 *
 * Використовує дискримінаційні об'єднання для типобезпечної
 * обробки подій симуляції.
 *
 * @module shared/types/events
 */

import type { EntityId, OrganismId } from './brands';
import type { Vector3 } from './vectors';
import type { EntityType } from './enums';
import type { SimulationStats } from './stats';

// ============================================================================
// ТИПИ ПОДІЙ
// ============================================================================

/**
 * Подія створення нової сутності.
 */
export interface EntitySpawnedEvent {
  readonly type: 'EntitySpawned';
  readonly entityType: EntityType;
  readonly id: EntityId;
  readonly position: Vector3;
  readonly parentId?: OrganismId;
}

/**
 * Подія смерті сутності.
 */
export interface EntityDiedEvent {
  readonly type: 'EntityDied';
  readonly entityType: EntityType;
  readonly id: EntityId;
  readonly position: Vector3;
  readonly causeOfDeath: CauseOfDeath;
}

/**
 * Подія репродукції організму.
 */
export interface EntityReproducedEvent {
  readonly type: 'EntityReproduced';
  readonly parentId: OrganismId;
  readonly childId: OrganismId;
  readonly position: Vector3;
  readonly generation: number;
}

/**
 * Подія оновлення такту симуляції.
 */
export interface TickUpdatedEvent {
  readonly type: 'TickUpdated';
  readonly tick: number;
  readonly stats: SimulationStats;
  readonly deltaTime: number;
}

/**
 * Подія колізії між сутностями.
 */
export interface CollisionEvent {
  readonly type: 'Collision';
  readonly entityA: EntityId;
  readonly entityB: EntityId;
  readonly position: Vector3;
}

// ============================================================================
// ДОПОМІЖНІ ТИПИ
// ============================================================================

/**
 * Причина смерті організму.
 */
export type CauseOfDeath = 'starvation' | 'predation' | 'old_age';

/**
 * Об'єднаний тип усіх подій симуляції.
 */
export type SimulationEvent =
  | EntitySpawnedEvent
  | EntityDiedEvent
  | EntityReproducedEvent
  | TickUpdatedEvent
  | CollisionEvent;

/**
 * Callback для підписки на події.
 */
export type SimulationEventCallback = (event: SimulationEvent) => void;
