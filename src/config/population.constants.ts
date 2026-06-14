/**
 * Population and resource base constants.
 * Initial state parameters for Lotka-Volterra model and energy substrates.
 */

/** Maximum allowable total number of agents to maintain rendering frequency (60 FPS). */
export const MAX_TOTAL_ORGANISMS = 400;

/** Initial sample size of prey subjects (herbivores). */
export const INITIAL_PREY = 150;

/** Initial sample size of predator subjects. */
export const INITIAL_PREDATOR = 5;

/** Maximum allowable number of energy substrate units in the environment. */
export const MAX_FOOD = 400;

/** Energy resource generation intensity per iteration (tick). */
export const FOOD_SPAWN_RATE = 0.8;

/** Quantitative equivalent of energy value per resource unit. */
export const FOOD_ENERGY_VALUE = 60;

/** Maximum number of dead bodies stored in simulation. */
export const MAX_DEAD_BODIES = 500;
