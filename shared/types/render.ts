/**
 * Entropia 3D — Типи для рендерингу та передачі даних.
 *
 * Оптимізовані структури для ефективного передавання
 * даних між симуляцією та рендерером.
 *
 * @module shared/types/render
 */

import type { OrganismId, FoodId, ObstacleId } from './brands';
import type { Vector3 } from './vectors';
import type { EntityType, OrganismState } from './enums';
import type { Genome } from './genome';
import type { SimulationEvent } from './events';
import type { SimulationStats } from './stats';

// ============================================================================
// БУФЕРИ ДЛЯ WEB WORKERS
// ============================================================================

/**
 * Оптимізовані буфери для zero-copy передачі даних.
 *
 * Використовує Float32Array для максимальної ефективності.
 */
export interface RenderBuffers {
  /**
   * Дані травоїдних організмів.
   * Stride: 13 floats per entity
   * [0-2] position (x, y, z)
   * [3-5] velocity (x, y, z)
   * [6] radius
   * [7] rotation (reserved)
   * [8] id (numeric part)
   * [9-12] reserved
   */
  prey: Float32Array;
  preyCount: number;

  /**
   * Дані хижих організмів.
   * Stride: 13 floats per entity
   */
  predators: Float32Array;
  predatorCount: number;

  /**
   * Дані їжі.
   * Stride: 5 floats per entity
   * [0-2] position (x, y, z)
   * [3] radius/scale
   * [4] id (numeric part)
   */
  food: Float32Array;
  foodCount: number;
}

// ============================================================================
// RENDER DATA STRUCTURES
// ============================================================================

/**
 * Дані організму для рендерингу.
 */
export interface OrganismRenderData {
  readonly id: OrganismId;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly radius: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly type: EntityType;
  readonly state: OrganismState;
  readonly genome: Genome;
  readonly trailEnabled: boolean;
  readonly age: number;
}

/**
 * Дані їжі для рендерингу.
 */
export interface FoodRenderData {
  readonly id: FoodId;
  readonly position: Vector3;
  readonly radius: number;
  readonly energyValue: number;
}

/**
 * Дані перешкоди для рендерингу.
 */
export interface ObstacleRenderData {
  readonly id: ObstacleId;
  readonly position: Vector3;
  readonly radius: number;
  readonly color: number;
  readonly opacity: number;
}

/**
 * Агрегований кадр для рендерингу.
 */
export interface RenderFrame {
  readonly tick: number;
  readonly organisms: readonly OrganismRenderData[];
  readonly food: readonly FoodRenderData[];
  readonly obstacles: readonly ObstacleRenderData[];
  readonly events: readonly SimulationEvent[];
  readonly stats: SimulationStats;
}
