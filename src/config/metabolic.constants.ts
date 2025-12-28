/**
 * Metabolic processes constants.
 * Entropy model of thermodynamics for biological agents.
 */

export const METABOLIC_CONSTANTS = {
  /** Energy costs for maintaining basic homeostasis and vital functions. */
  exist: 0.03,

  /** Locomotion costs proportional to kinetic component. */
  move: 0.004,

  /** Costs for sensory systems operation and signal processing. */
  sense: 0.0005,

  /** Scale coefficient (allometric dependence of costs on subject size). */
  size: 0.001,
} as const;

export const METABOLIC_THRESHOLDS = {
  /** Energy level for hunger state (normalized < 0.5). */
  hunger: 0.5,
  /** Critical energy level for exhaustion state (normalized < 0.2). */
  critical: 0.2,
  /** Old age threshold (relative to maximum age). */
  oldAgeRatio: 0.8,
} as const;

/** Initial energy potential of newly formed organism. */
export const INITIAL_ENERGY = 100;

/** Maximum energy capacity of biological subject. */
export const MAX_ENERGY = 300;
