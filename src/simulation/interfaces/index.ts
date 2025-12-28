/**
 * Simulation abstraction layer.
 * Provides interfaces for dependency inversion and testability.
 */

export type { IEntity } from './IEntity';
export { isEntity } from './IEntity';
export type { IEntityRepository } from './IEntityRepository';
export { MapEntityRepository } from './IEntityRepository';
export type { ISimulationContext } from './ISimulationContext';
export type {
  ICameraData,
  IEntityInfo,
  ISimulationEngine,
} from './ISimulationEngine';
export type { ISystem, ISystemUpdateResult } from './ISystem';
export { isSystem } from './ISystem';
