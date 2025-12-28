/**
 * Ecological zones and environment modifiers.
 * Zone-specific resource and danger multipliers.
 */

export const ZONE_DEFAULTS = {
  OASIS: {
    foodMultiplier: 3.0,
    dangerMultiplier: 0.5,
    color: 0x44ff88,
  },
  DESERT: {
    foodMultiplier: 0.2,
    dangerMultiplier: 1.0,
    color: 0xffaa44,
  },
  HUNTING_GROUND: {
    foodMultiplier: 1.0,
    dangerMultiplier: 2.0,
    color: 0xff4444,
  },
  SANCTUARY: {
    foodMultiplier: 1.5,
    dangerMultiplier: 0.1,
    color: 0x4488ff,
  },
} as const;
