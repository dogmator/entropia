/**
 * Genetic apparatus and variability.
 * Gene expression bounds and predator strategy classification.
 */

import type { PredatorSubtype } from '@/types';

export const GENETICS = {
  /** Integral coefficient of mutation probability (0.12 equivalent to 12%). */
  mutationFactor: 0.12,

  /** Lower bounds of genetic trait expression. */
  min: {
    maxSpeed: 0.8,
    senseRadius: 25,
    metabolism: 0.5,
    size: 2.5,
    asymmetry: 0,
    spikiness: 0,
    glowIntensity: 0.2,
  },

  /** Upper bounds of genetic trait expression. */
  max: {
    maxSpeed: 4.5,
    senseRadius: 200,
    metabolism: 2.0,
    size: 10,
    asymmetry: 1,
    spikiness: 1,
    glowIntensity: 1,
  },

  /** Base phenotype of prey subjects. */
  preyBase: {
    maxSpeed: 2.2,
    senseRadius: 90,
    metabolism: 1.0,
    size: 4,
    flockingStrength: 0.5,
  },

  /** Base phenotype of predator subjects. */
  predatorBase: {
    maxSpeed: 2.6,
    senseRadius: 160,
    metabolism: 1.2,
    size: 6,
    attackPower: 1.0,
    packAffinity: 0.3,
  },
} as const;

/** Classification of predator strategies. */
export const PREDATOR_SUBTYPES: Record<
  PredatorSubtype,
  {
    speedMultiplier: number;
    senseMultiplier: number;
    attackMultiplier: number;
    color: number;
  }
> = {
  HUNTER: {
    speedMultiplier: 1.3,
    senseMultiplier: 0.8,
    attackMultiplier: 0.7,
    color: 0xff4444,
  },
  AMBUSHER: {
    speedMultiplier: 0.7,
    senseMultiplier: 1.2,
    attackMultiplier: 1.4,
    color: 0xcc2222,
  },
  PACK: {
    speedMultiplier: 1.0,
    senseMultiplier: 1.0,
    attackMultiplier: 1.0,
    color: 0xff6666,
  },
} as const;
