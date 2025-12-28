/**
 * Dynamic world configuration with scaling support.
 */

import type { WorldConfig } from '@/types';

import {
  FOOD_SPAWN_RATE,
  INITIAL_PREDATOR,
  INITIAL_PREY,
  MAX_FOOD,
  MAX_TOTAL_ORGANISMS,
} from './population.constants';
import { WORLD_SIZE } from './world.constants';

/** Volume scaling exponent for 3D space. */
const VOLUME_EXPONENT = 3;

/**
 * Generates world configuration with scaling factor.
 * @param scale Scale coefficient (default 1.0).
 */
export function createWorldConfig(scale: number = 1.0): WorldConfig {
  const volumeScale = Math.pow(scale, VOLUME_EXPONENT);

  return {
    WORLD_SIZE: WORLD_SIZE * scale,
    // Scale population limit proportional to volume (scale^3) to preserve density
    MAX_TOTAL_ORGANISMS: Math.floor(MAX_TOTAL_ORGANISMS * volumeScale),
    INITIAL_PREY: Math.floor(INITIAL_PREY * volumeScale),
    INITIAL_PREDATOR: Math.floor(INITIAL_PREDATOR * volumeScale),
    // Resources also scale by volume
    MAX_FOOD: Math.floor(MAX_FOOD * volumeScale),
    FOOD_SPAWN_RATE: FOOD_SPAWN_RATE * volumeScale,
  };
}
