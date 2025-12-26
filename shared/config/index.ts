/**
 * Entropia 3D — Центральний експорт конфігурації.
 *
 * @module shared/config
 */

// Параметри світу
export {
  WORLD_SIZE,
  CELL_SIZE,
  MAX_TOTAL_ORGANISMS,
  INITIAL_PREY,
  INITIAL_PREDATOR,
  MAX_FOOD,
  FOOD_SPAWN_RATE,
  FOOD_ENERGY_VALUE,
  createWorldConfig,
} from './world';

// Фізика
export { PHYSICS, INTERACTION } from './physics';

// Генетика
export {
  GENETICS,
  PREDATOR_SUBTYPES,
  METABOLIC_CONSTANTS,
  METABOLIC_THRESHOLDS,
  REPRODUCTION,
  REPRODUCTION_ENERGY_THRESHOLD,
  INITIAL_ENERGY,
  MAX_ENERGY,
  MIN_REPRODUCTION_AGE,
} from './genetics';

// Рендеринг
export {
  RENDER,
  COLORS,
  ZONE_DEFAULTS,
  INITIAL_VIS_CONFIG,
  GRAPHICS_PRESETS,
  UI_CONFIG,
  AUDIO,
} from './render';
