/**
 * Entropia 3D — Типи конфігурації симуляції.
 *
 * Визначає структури налаштувань для всіх підсистем.
 *
 * @module shared/types/config
 */

import type { GraphicsQuality } from './enums';

// ============================================================================
// КОНФІГУРАЦІЯ СВІТУ
// ============================================================================

/**
 * Фізичні параметри віртуального світу.
 */
export interface WorldConfig {
  /** Лінійна розмірність кубічного домену. */
  readonly WORLD_SIZE: number;
  /** Гранично допустима чисельність агентів. */
  readonly MAX_TOTAL_ORGANISMS: number;
  /** Початкова кількість травоїдних. */
  readonly INITIAL_PREY: number;
  /** Початкова кількість хижаків. */
  readonly INITIAL_PREDATOR: number;
  /** Максимальна кількість їжі. */
  readonly MAX_FOOD: number;
  /** Швидкість респавну їжі. */
  readonly FOOD_SPAWN_RATE: number;
}

// ============================================================================
// КОНФІГУРАЦІЯ ВІЗУАЛІЗАЦІЇ
// ============================================================================

/**
 * Параметри візуального відображення.
 */
export interface VisConfig {
  readonly organismOpacity: number;
  readonly foodOpacity: number;
  readonly organismScale: number;
  readonly foodScale: number;
  readonly gridOpacity: number;
  readonly bloomIntensity: number;
  readonly trailLength: number;
  readonly showEnergyGlow: boolean;
  readonly showTrails: boolean;
  readonly showParticles: boolean;
  readonly graphicsQuality: GraphicsQuality;
}

// ============================================================================
// КОНФІГУРАЦІЯ ФІЗИКИ
// ============================================================================

/**
 * Параметри фізичної симуляції (Boids алгоритм).
 */
export interface PhysicsConfig {
  /** Коефіцієнт опору середовища. */
  readonly drag: number;
  /** Вага сили сепарації. */
  readonly separationWeight: number;
  /** Вага сили вирівнювання. */
  readonly alignmentWeight: number;
  /** Вага сили когезії. */
  readonly cohesionWeight: number;
  /** Вага вектора прагнення до цілі. */
  readonly seekWeight: number;
  /** Вага вектора уникнення. */
  readonly avoidWeight: number;
}

// ============================================================================
// АГРЕГОВАНА КОНФІГУРАЦІЯ
// ============================================================================

/**
 * Повна конфігурація симуляції.
 */
export interface SimulationConfig extends VisConfig, PhysicsConfig {
  readonly foodSpawnRate: number;
  readonly maxFood: number;
  readonly maxOrganisms: number;
  readonly showObstacles: boolean;
  readonly mutationFactor: number;
  readonly reproductionThreshold: number;
}
