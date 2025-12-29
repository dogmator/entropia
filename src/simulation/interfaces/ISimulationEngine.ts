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
  EntityType,
  GenomeId,
  MemoryStats,
  RenderBuffers,
  SerializedSimulationStateV1,
  SimulationConfig,
  SimulationStats,
  SystemMetrics,
  Vector3,
  WorldConfig,
} from '@/types';
import type { Obstacle } from '@/simulation';

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
  type: EntityType;
  position: Vector3;
  radius: number;
}

export interface IPerformanceMonitor {
  getMemoryStats(): MemoryStats | null;
  getPerformanceHistory(): SystemMetrics[];
}

/**
 * Main engine interface - implemented by SimulationEngine and EngineProxy.
 */
export interface ISimulationEngine {
  /** Current simulation configuration */
  readonly config: SimulationConfig;

  /** World configuration (size, scale) */
  /** World configuration (size, scale) */
  readonly worldConfig: WorldConfig;

  /** Ecological zones */
  readonly zones: Map<string, EcologicalZone>;

  /** Static obstacles */
  readonly obstacles: Map<string, Obstacle>;

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
   * Get current simulation statistics with world data.
   * @returns Stats snapshot
   */
  getStatsWithWorldData(): SimulationStats;

  /**
   * Reset simulation to initial state.
   */
  reset(): void;

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
   * @param maxDistance - Search radius
   * @returns Entity info or null
   */
  findEntityAt(worldPosition: Vector3, maxDistance: number): Promise<IEntityInfo | null>;

  /**
   * Get entity by instance ID from render buffer.
   * @param entityType - Type of entity
   * @param instanceId - Instance ID from buffer
   * @param isDead - Whether to search in dead organisms
   * @returns Entity info or null
   */
  getEntityByInstanceId(entityType: string, instanceId: number, isDead?: boolean): Promise<IEntityInfo | null>;

  /**
   * Get genetic tree node by genome ID.
   * @param genomeId - Genome identifier
   * @param genomeId - Genome identifier
   * @returns Tree node or undefined
   */
  getGeneticNode(genomeId: GenomeId): Promise<unknown>;

  /**
   * Get all genetic tree roots.
   * @returns Array of root genome IDs
   */
  getGeneticRoots(): Promise<GenomeId[]>;

  /**
   * Export current simulation state.
   * @returns Serialized state
   */
  exportState(): SerializedSimulationStateV1;

  /**
   * Update simulation configuration.
   * @param newConfig - New configuration
   */
  updateConfig(newConfig: Partial<SimulationConfig>): void;

  /**
   * Update world scale and re-initialize world.
   * @param scale - New world scale
   */
  updateWorldScale(scale: number): void;

  /**
   * Get performance monitor.
   */
  getPerformanceMonitor(): IPerformanceMonitor;

  /**
   * Cleanup and destroy engine.
   */
  destroy?(): void;

  /**
   * Subscribe to simulation events.
   * @param callback - Event handler
   * @returns Unsubscribe function
   */
  addEventListener(callback: (event: import('@/types').SimulationEvent) => void): () => void;
}
