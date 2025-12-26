/**
 * Entropia 3D — Параметри генетичної системи.
 *
 * Константи для мутацій, репродукції та фенотипів.
 *
 * @module shared/config/genetics
 */

import type { PredatorSubtype } from '../types';

// ============================================================================
// ГЕНЕТИЧНІ ПАРАМЕТРИ
// ============================================================================

export const GENETICS = {
  /** Коефіцієнт ймовірності мутацій (12%). */
  mutationFactor: 0.12,

  /** Мінімальні межі генетичних ознак. */
  min: {
    maxSpeed: 0.8,
    senseRadius: 25,
    metabolism: 0.5,
    size: 2.5,
    asymmetry: 0,
    spikiness: 0,
    glowIntensity: 0.2,
  },

  /** Максимальні межі генетичних ознак. */
  max: {
    maxSpeed: 4.5,
    senseRadius: 200,
    metabolism: 2.0,
    size: 10,
    asymmetry: 1,
    spikiness: 1,
    glowIntensity: 1,
  },

  /** Базовий фенотип травоїдних. */
  preyBase: {
    maxSpeed: 2.2,
    senseRadius: 90,
    metabolism: 1.0,
    size: 4,
    flockingStrength: 0.5,
  },

  /** Базовий фенотип хижаків. */
  predatorBase: {
    maxSpeed: 2.6,
    senseRadius: 160,
    metabolism: 1.2,
    size: 6,
    attackPower: 1.0,
    packAffinity: 0.3,
  },
} as const;

// ============================================================================
// ПІДТИПИ ХИЖАКІВ
// ============================================================================

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

// ============================================================================
// МЕТАБОЛІЗМ
// ============================================================================

export const METABOLIC_CONSTANTS = {
  /** Базові витрати на підтримку гомеостазу. */
  exist: 0.03,

  /** Витрати на рух (пропорційно швидкості). */
  move: 0.004,

  /** Витрати на сенсорні системи. */
  sense: 0.0005,

  /** Алометричний коефіцієнт (витрати від розміру). */
  size: 0.001,
} as const;

export const METABOLIC_THRESHOLDS = {
  /** Рівень енергії для стану голоду. */
  hunger: 0.5,

  /** Критичний рівень енергії. */
  critical: 0.2,

  /** Поріг старості (частка від max віку). */
  oldAgeRatio: 0.8,
} as const;

// ============================================================================
// РЕПРОДУКЦІЯ
// ============================================================================

export const REPRODUCTION = {
  /** Частка енергії, що залишається у батька після поділу. */
  energyCostMultiplier: 0.45,
} as const;

/** Поріг енергії для розмноження. */
export const REPRODUCTION_ENERGY_THRESHOLD = 180;

/** Початкова енергія організму. */
export const INITIAL_ENERGY = 100;

/** Максимальна енергія організму. */
export const MAX_ENERGY = 300;

/** Мінімальний вік для розмноження. */
export const MIN_REPRODUCTION_AGE = 60;
