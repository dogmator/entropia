/**
 * Unified interface for all simulation systems.
 * Enforces consistent API and enables polymorphic system management.
 *
 * Benefits:
 * - Add new systems without modifying engine core
 * - Easy to test (mock ISystem)
 * - Clear separation of concerns
 * - Type-safe system orchestration
 */

import type { ISimulationContext } from './ISimulationContext';

/**
 * Result of system update - can contain new entities or IDs to remove.
 */
export interface ISystemUpdateResult {
  /** IDs of entities to remove (e.g., dead organisms) */
  entitiesToRemove?: string[];

  /** Data for new entities to spawn */
  newEntities?: unknown[];
}

/**
 * Base interface for all simulation systems.
 * Systems process entities and modify simulation state.
 */
export interface ISystem {
  /**
   * Update system for current tick.
   * @param context - Full simulation context
   * @returns Update result with entities to add/remove
   */
  update(context: ISimulationContext): ISystemUpdateResult | void;

  /**
   * Optional initialization hook called once before first update.
   * @param context - Full simulation context
   */
  initialize?(context: ISimulationContext): void;

  /**
   * Optional cleanup hook called when system is destroyed.
   */
  destroy?(): void;

  /**
   * Optional name for debugging and logging.
   */
  readonly name?: string;
}

/**
 * Type guard to check if object implements ISystem.
 */
export function isSystem(obj: unknown): obj is ISystem {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'update' in obj &&
    typeof (obj as ISystem).update === 'function'
  );
}
