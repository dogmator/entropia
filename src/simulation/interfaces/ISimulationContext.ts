/**
 * Simulation execution context passed to systems.
 * Contains all data needed for system updates.
 *
 * Benefits:
 * - Single source of truth for system dependencies
 * - Easy to extend without changing system signatures
 * - Simplifies testing (mock entire context)
 */

import type { EventBus } from '@/core';
import type { EcologicalZone, SimulationConfig, WorldConfig } from '@/types';

import type { Food, Obstacle, Organism } from '../Entity';
import type { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Execution context for systems - contains all simulation state.
 */
export interface ISimulationContext {
  /** All organisms in the simulation */
  readonly organisms: Map<string, Organism>;

  /** All food items in the simulation */
  readonly food: Map<string, Food>;

  /** All obstacles in the simulation */
  readonly obstacles: Map<string, Obstacle>;

  /** Ecological zones */
  readonly zones: Map<string, EcologicalZone>;

  /** Spatial hash grid for efficient queries */
  readonly spatialGrid: SpatialHashGrid;

  /** Event bus for decoupled communication */
  readonly eventBus: EventBus;

  /** Simulation configuration */
  readonly config: SimulationConfig;

  /** World configuration (size, scale) */
  readonly worldConfig: WorldConfig;

  /** Current simulation tick */
  readonly tick: number;
}
