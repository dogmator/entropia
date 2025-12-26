/**
 * Entropia 3D — Параметри рендерингу та візуалізації.
 *
 * Константи для Three.js, ефектів та UI.
 *
 * @module shared/config/render
 */

import type { GraphicsQuality } from '../types';

// ============================================================================
// ПАРАМЕТРИ РЕНДЕРИНГУ
// ============================================================================

export const RENDER = {
  /** Максимальна кількість інстансів для InstancedMesh. */
  maxInstances: 400,

  /** Ліміт часток для трейлів. */
  maxTrailParticles: 120,

  /** Ліміт часток для ефектів. */
  maxEffectParticles: 2500,

  /** Цільова частота кадрів. */
  targetFPS: 60,

  /** Параметри bloom ефекту. */
  bloom: {
    strength: 0.6,
    radius: 0.4,
    threshold: 0.2,
  },

  /** Включити трейли для всіх організмів. */
  enableTracertForAllOrganisms: true,
} as const;

// ============================================================================
// КОЛІРНА ПАЛІТРА
// ============================================================================

export const COLORS = {
  prey: {
    base: 0x44ff88,
    glow: 0x88ffaa,
    death: 0x88ff88,
  },
  predator: {
    base: 0xff4466,
    glow: 0xff6688,
    death: 0xff8888,
  },
  food: {
    base: 0xffcc44,
    glow: 0xffdd66,
    emissive: 0xffaa00,
  },
  obstacle: {
    base: 0x8844ff,
    glow: 0xaa66ff,
  },
  ui: {
    background: 0x050505,
    accent: 0x10b981,
    danger: 0xef4444,
    warning: 0xf59e0b,
  },
} as const;

// ============================================================================
// ЕКОЛОГІЧНІ ЗОНИ
// ============================================================================

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

// ============================================================================
// КОНФІГУРАЦІЯ ВІЗУАЛІЗАЦІЇ
// ============================================================================

/** Налаштування за замовчуванням. */
export const INITIAL_VIS_CONFIG = {
  organismOpacity: 0.92,
  foodOpacity: 0.85,
  organismScale: 1.0,
  foodScale: 1.2,
  showGrid: true,
  gridOpacity: 0.2,
  bloomIntensity: 0.8,
  trailLength: 80,
  showEnergyGlow: true,
  showTrails: true,
  showParticles: true,
  graphicsQuality: 'HIGH' as GraphicsQuality,
} as const;

/** Пресети якості графіки. */
export const GRAPHICS_PRESETS: Record<
  Exclude<GraphicsQuality, 'CUSTOM'>,
  Omit<typeof INITIAL_VIS_CONFIG, 'showGrid'>
> = {
  LOW: {
    organismOpacity: 0.85,
    foodOpacity: 0.80,
    organismScale: 0.8,
    foodScale: 1.0,
    gridOpacity: 0.03,
    bloomIntensity: 0.3,
    trailLength: 20,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    graphicsQuality: 'LOW',
  },
  MEDIUM: {
    organismOpacity: 0.88,
    foodOpacity: 0.82,
    organismScale: 0.9,
    foodScale: 1.1,
    gridOpacity: 0.05,
    bloomIntensity: 0.5,
    trailLength: 40,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: false,
    graphicsQuality: 'MEDIUM',
  },
  HIGH: {
    organismOpacity: 0.92,
    foodOpacity: 0.85,
    organismScale: 1.0,
    foodScale: 1.2,
    gridOpacity: 0.08,
    bloomIntensity: 0.8,
    trailLength: 80,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'HIGH',
  },
  ULTRA: {
    organismOpacity: 0.95,
    foodOpacity: 0.90,
    organismScale: 1.2,
    foodScale: 1.4,
    gridOpacity: 0.12,
    bloomIntensity: 1.0,
    trailLength: 120,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'ULTRA',
  },
} as const;

// ============================================================================
// КОНФІГУРАЦІЯ UI
// ============================================================================

export const UI_CONFIG = {
  /** Максимальна ширина бічної панелі. */
  sidebarMaxWidth: '380px',

  /** Довжина історії для графіків. */
  historyLength: 120,

  /** Частота оновлення статистики (кожні N тактів). */
  updateFrequency: 15,
} as const;

// ============================================================================
// АУДІО (зарезервовано)
// ============================================================================

export const AUDIO = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.3,
  effectsVolume: 0.7,
} as const;
