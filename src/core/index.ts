/**
 * Entropia 3D — Центральний експорт core модуля.
 *
 * Містить утиліти, сервіси та інфраструктурні компоненти,
 * що не залежать від React або Three.js.
 *
 * @module core
 */

// EventBus — система подій
export { EventBus } from './EventBus';

// ObjectPool — пул об'єктів для оптимізації
export { ObjectPool } from './ObjectPool';

// Сервіси
export { Logger,logger } from './services/Logger';
export { PerformanceMonitor } from './services/PerformanceMonitor';

// Утиліти
export { type MemoryInfo,PerformanceHelpers } from './utils/PerformanceUtils';
export { Random } from './utils/Random';
