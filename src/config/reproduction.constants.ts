/**
 * Reproduction and ontogenesis mechanisms.
 * Parameters for organism replication and lifecycle.
 */

export const REPRODUCTION = {
  /** Fraction of energy retained by parent organism after division. */
  energyCostMultiplier: 0.45,
} as const;

/** Critical energy threshold required to initiate replication (reproduction) process. */
export const REPRODUCTION_ENERGY_THRESHOLD = 180;

/** Minimum lifecycle duration (in iterations) before acquiring reproductive capability. */
export const MIN_REPRODUCTION_AGE = 60;
