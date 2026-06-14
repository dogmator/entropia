/**
 * Entropia 3D — Central export for core module.
 *
 * Contains utilities, services, and infrastructure components
 * independent of React or Three.js.
 *
 * @module core
 */

// EventBus — event system
export { EventBus } from './EventBus.service';

// ObjectPool — object pool for optimization
export { ObjectPool } from './ObjectPool.service';

// Services
export { Logger,logger } from './services/Logger.service';
export { PerformanceMonitor } from './services/PerformanceMonitor.service';

// Utilities
export { type MemoryInfo,PerformanceHelpers } from './utils/PerformanceUtils.utils';
export { Random } from './utils/Random.utils';
