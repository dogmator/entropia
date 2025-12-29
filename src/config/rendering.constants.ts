/**
 * Rendering and visual effects constants.
 * Graphics configuration, color palettes, presets, and entity rendering parameters.
 */

import type { GraphicsQuality, VisConfig } from '@/types';

/** Default visual parameters configuration. */
export const INITIAL_VIS_CONFIG: VisConfig = {
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

/** Graphics intensity preset sets. */
export const GRAPHICS_PRESETS: Record<
  Exclude<GraphicsQuality, 'CUSTOM'>,
  VisConfig
> = {
  LOW: {
    organismOpacity: 0.85,
    foodOpacity: 0.80,
    organismScale: 0.8,
    foodScale: 1.0,
    showGrid: false,
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
    showGrid: true,
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
    showGrid: true,
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
    showGrid: true,
    gridOpacity: 0.12,
    bloomIntensity: 1.0,
    trailLength: 120,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'ULTRA',
  },
} as const;

export const RENDER = {
  /** Maximum number of instances for InstancedMesh structures. */
  maxInstances: 400,
  foodInstanceMultiplier: 2,

  /** Particle limit for trail systems. */
  maxTrailParticles: 120,

  /** Total particle limit for dynamic visual effects. */
  maxEffectParticles: 2500,

  /** Target frame rate. */
  targetFPS: 60,

  /** Bloom effect processing parameters. */
  bloom: {
    strength: 0.6,
    radius: 0.4,
    threshold: 0.2,
  },

  /** Entity geometry and materials constants. */
  geometry: {
    organism: {
      radius: 0.8,
      height: 2.5,
      segments: 12,
    },
    food: {
      radius: 2,
      segments: 8,
    },
    velocityThreshold: 0.01,
  },

  materials: {
    opacity: 0.92,
    foodOpacity: 0.85,
    shininess: {
      prey: 30,
      predator: 40,
      food: 100,
    },
    emissiveIntensity: {
      prey: 0.15,
      predator: 0.2,
      food: 0.5,
    },
  },

  interaction: {
    hoverInterval: 0.1,
    foodRotationSpeed: 0.5,
    foodRotationSecondary: 0.3,
    foodScaleBase: 1.25,
  },

  enableTracertForAllOrganisms: true,
} as const;

export const ENVIRONMENT_RENDERING = {
  BOX_OPACITY: 0.08,
  ZONE_OPACITY: 0.05,
  ZONE_SEGMENTS: 16,
  OBSTACLE_SEGMENTS: 2,
  OBSTACLE_EMISSIVE_INTENSITY: 0.1,
  DEFAULT_ZONE_COLOR: 0xffffff,
  CENTER_DIVIDER: 2,
} as const;

export const BUFFER_LAYOUT = {
  STRIDE: 13,
  FOOD_STRIDE: 5,
  OFFSETS: {
    X: 0,
    Y: 1,
    Z: 2,
    VX: 3,
    VY: 4,
    VZ: 5,
    RADIUS: 6,
    IS_DEAD: 7,
    ID: 8,
    TYPE: 9,
    STATE: 10,
    AGE: 11,
    MAX_ENERGY: 12,
  },
  FOOD_OFFSETS: {
    X: 0,
    Y: 1,
    Z: 2,
    RADIUS: 3,
    ID: 4,
  },
  DEAD_THRESHOLD: 0.5,
} as const;

export const CAMERA = {
  INITIAL_STATE: {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1,
    distance: 0,
    fov: 60,
    aspect: 1,
    near: 0.1,
    far: 5000,
  },
  AUTO_ROTATE: {
    ENABLED: true,
    SPEED: 2.0,
    SPEED_MIN: 0.1,
    SPEED_MAX: 20,
  },
} as const;

/** Color palette. */
export const COLORS = {
  prey: {
    base: 0x44ff88,
    glow: 0x88ffaa,
    // дужче зменьшити яркость при загибели
    death: 0x44ff44,
    trail: 0x66ff99,
  },
  predator: {
    base: 0xff4466,
    glow: 0xff6688,
    death: 0xff4444,
    trail: 0xff6688,
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

/**
 * Cosmic background constants (star field and nebulae).
 */
export const COSMIC_BACKGROUND_CONSTANTS = {
  // Star field parameters
  STAR_COUNT: 3000,
  STAR_RADIUS: 2000,
  STAR_RADIUS_MIN_FACTOR: 0.8,
  STAR_RADIUS_VARIATION: 0.4,
  STAR_SIZE_POWER: 3,
  STAR_SIZE_MULTIPLIER: 3,
  STAR_SIZE_BASE: 0.5,
  STAR_BRIGHTNESS_BASE: 0.5,
  STAR_BRIGHTNESS_VARIATION: 0.5,
  STAR_TWINKLE_BASE: 1,
  STAR_TWINKLE_VARIATION: 3,

  // Nebula parameters
  NEBULA_RADIUS: 1800,
  NEBULA_SEGMENTS: 64,
  NEBULA_ROTATION_Y: 0.01,
  NEBULA_ROTATION_X: 0.005,

  // 3D vector constants
  VECTOR3_COMPONENTS: 3,
  VECTOR2_MULTIPLIER: 2,
  SINGLE_COMPONENT: 1,
  TWO_PI: Math.PI * 2,
} as const;

/**
 * Entity creation and mutation constants.
 * Used in Entity.ts, GenomeFactory, OrganismFactory.
 */
export const ENTITY_CONSTANTS = {
  // Food properties
  FOOD_RADIUS: 2,

  // Prey genome creation variance
  PREY_SPEED_VARIANCE: 0.5,
  PREY_SENSE_VARIANCE: 20,
  PREY_METABOLISM_VARIANCE: 0.2,
  PREY_SIZE_VARIANCE: 1,
  PREY_ASYMMETRY_MAX: 0.3,
  PREY_SPIKINESS_MAX: 0.2,
  PREY_GLOW_MIN: 0.3,
  PREY_GLOW_VARIANCE: 0.3,
  PREY_FLOCKING_VARIANCE: 0.2,

  // Predator genome creation variance
  PREDATOR_SPEED_VARIANCE: 0.5,
  PREDATOR_SENSE_VARIANCE: 30,
  PREDATOR_METABOLISM_VARIANCE: 0.2,
  PREDATOR_SIZE_VARIANCE: 1.5,
  PREDATOR_ASYMMETRY_MAX: 0.4,
  PREDATOR_SPIKINESS_MIN: 0.3,
  PREDATOR_SPIKINESS_VARIANCE: 0.4,
  PREDATOR_GLOW_MIN: 0.4,
  PREDATOR_GLOW_VARIANCE: 0.4,
  PREDATOR_PACK_VARIANCE: 0.2,

  // Obstacle properties
  OBSTACLE_COLOR_VARIANCE: 0x222222,
  OBSTACLE_OPACITY_MIN: 0.3,
  OBSTACLE_OPACITY_VARIANCE: 0.5,
  OBSTACLE_WIREFRAME_THRESHOLD: 0.7,

  // Organism properties
  VELOCITY_RANGE: 2,
  OFFSPRING_RADIUS_MULTIPLIER: 2,

  // Trait mutation bounds
  TRAIT_MIN_BOUND: 0,
  TRAIT_MAX_BOUND: 1,
  TRAIT_MIN_ATTACK: 0.5,
  TRAIT_MAX_ATTACK: 2.0,
  TRAIT_MUTATION_FACTOR: 2,

  // Subtype inheritance
  SUBTYPE_INHERITANCE_PROBABILITY: 0.9,
} as const;
