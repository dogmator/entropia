/**
 * Metabolic process constants.
 * Entropy model of biological agent thermodynamics.
 */

export const METABOLIC_CONSTANTS = {
  /** Energy cost to maintain base homeostasis and vital functions. */
  exist: 0.01,

  /** Cost of locomotion, proportional to kinetic component. */
  move: 0.001,

  /** Cost of sensory system functioning and signal processing. */
  sense: 0.0005,

  /** Scaling factor (allometric dependence of costs on subject size). */
  size: 0.001,
} as const;

export const METABOLIC_THRESHOLDS = {
  /** Energy level for transition to hunger state (normalized < 0.5). */
  hunger: 0.5,
  /** Critical energy level for exhaustion state (normalized < 0.2). */
  critical: 0.2,
  /** Old age threshold (relative to maximum age). */
  oldAgeRatio: 0.8,
} as const;

/** Initial energy potential of a newly created organism. */
export const INITIAL_ENERGY = 200;

/** Maximum energy capacity of a biological subject. */
export const MAX_ENERGY = 300;
