/**
 * Population and resource base constants.
 * Initial state parameters for Lotka-Volterra model and energy substrates.
 */

/** Maximum allowed total number of agents to maintain terminal rendering frequency (60 FPS). */
export const MAX_TOTAL_ORGANISMS = 400;

/** Initial sample size of prey subjects. */
export const INITIAL_PREY = 80;

/** Initial sample size of predator subjects. */
export const INITIAL_PREDATOR = 8;

/** Maximum allowed quantity of energy substrate units in the environment. */
export const MAX_FOOD = 300;

/** Intensity of energy resource generation per iteration (tick). */
export const FOOD_SPAWN_RATE = 0.5;

/** Quantitative equivalent of energy value for a single resource unit. */
export const FOOD_ENERGY_VALUE = 40;
