/**
 * Entropia 3D — Export of simulation services.
 *
 * @module simulation/services
 */

export { BufferManager } from './BufferManager.manager';
export { DeathProcessor } from './DeathProcessor.processor';
export { buildInitialPopulation, buildObstacles, buildZones } from './EnvironmentBuilder.builder';
export { FoodAnomalyGuard } from './FoodAnomalyGuard.guard';
export { SpawnService } from './Spawn.service';
export { type CameraData, StatisticsManager } from './StatisticsManager.manager';
