/**
 * Public API contract for simulation engine.
 * Defines interface for both SimulationEngine and EngineProxy.
 *
 * Benefits:
 * - UI depends on interface, not implementation
 * - Easy to swap between direct engine and worker proxy
 * - Clear API boundaries
 * - Testability (mock engine)
 */

import type {
  EcologicalZone,
  EntityId,
  GenomeId,
  RenderBuffers,
  SerializedSimulationStateV1,
  SimulationConfig,
  SimulationStats,
  Vector3,
  WorldConfig,
} from '@/types';

/**
 * Camera data for rendering.
 */
export interface ICameraData {
  position: Vector3;
  target: Vector3;
}

/**
 * Entity information for UI selection.
 */
export interface IEntityInfo {
  id: EntityId;
  type: string;
  position: Vector3;
  // Additional fields added dynamically based on entity type
  [key: string]: unknown;
}

/**
 * Main engine interface - implemented by SimulationEngine and EngineProxy.
 */
export interface ISimulationEngine {
  /** Current simulation configuration */
  readonly config: SimulationConfig;

  /** World configuration (size, scale) */
  readonly worldConfig: WorldConfig;

  /**
   * Advance simulation by one tick.
   */
  update(): void;

  /**
   * Get render buffers for visualization.
   * @returns Float32Array buffers for instanced rendering
   */
  getRenderData(): RenderBuffers;

  /**
   * Get current simulation statistics.
   * @returns Stats snapshot
   */
  getStats(): SimulationStats;

  /**
   * Update camera data for rendering optimizations.
   * @param position - Camera position
   * @param target - Camera look-at target
   */
  setCameraData(position: Vector3, target: Vector3): void;

  /**
   * Find entity at world position.
   * @param worldPosition - 3D coordinates
   * @param maxDistance - Search radius
   * @returns Entity info or null
   */
  findEntityAt(worldPosition: Vector3, maxDistance: number): IEntityInfo | null;

  /**
   * Get entity by instance ID from render buffer.
   * @param entityType - Type of entity
   * @param instanceId - Instance ID from buffer
   * @returns Entity info or null
   */
  getEntityByInstanceId(entityType: string, instanceId: number): IEntityInfo | null;

  /**
   * Get genetic tree node by genome ID.
   * @param genomeId - Genome identifier
   * @returns Tree node or undefined
   */
  getGeneticNode(genomeId: GenomeId): unknown;

  /**
   * Get all genetic tree roots.
   * @returns Array of root genome IDs
   */
  getGeneticRoots(): GenomeId[];

  /**
   * Export current simulation state.
   * @returns Serialized state
   */
  exportState(): SerializedSimulationStateV1;

  /**
   * Import and restore simulation state.
   * @param state - Serialized state
   */
  importState(state: SerializedSimulationStateV1): void;

  /**
   * Update simulation configuration.
   * @param newConfig - New configuration
   */
  updateConfig(newConfig: Partial<SimulationConfig>): void;

  /**
   * Get all ecological zones.
   * @returns Map of zones
   */
  getZones(): Map<string, EcologicalZone>;

  /**
   * Cleanup and destroy engine.
   */
  destroy?(): void;
}
