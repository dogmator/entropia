/**
 * Performance monitoring and optimization constants.
 * Thresholds, object pool sizes, and particle system parameters.
 */

/**
 * Performance monitoring constants and threshold values.
 */
export const PERFORMANCE_CONSTANTS = {
  // Buffers and history sizes
  MAX_ENTRIES: 300,
  RING_BUFFER_SIZE: 60,
  RECENT_ENTRIES_WINDOW: 10,

  // Update intervals (ms)
  FPS_UPDATE_INTERVAL: 500,
  MEMORY_COLLECTION_INTERVAL: 5000,
  CLEANUP_INTERVAL: 30000,
  UPDATE_THRESHOLD: 1000,
  SLOW_MEMORY_INTERVAL: 10000,
  RECOVERY_TIMEOUT: 30000,
  QUICK_RECOVERY_TIMEOUT: 5000,
  AVG_PERFORMANCE_WINDOW: 60000,
  SHORT_AVG_WINDOW: 10000,

  // FPS thresholds
  DEFAULT_FPS: 60,
  DEFAULT_TPS: 60,
  FPS_CRITICAL_LOW: 10,
  FPS_LOW: 15,
  FPS_MEDIUM: 30,
  FPS_GOOD: 50,

  // Time thresholds (ms)
  FRAME_TIME_WARNING: 20,
  FRAME_TIME_CRITICAL: 33,
  SUBSYSTEM_SLOW_THRESHOLD: 5,
  MIN_EXECUTION_TIME: 0.1,

  // Memory thresholds
  MEMORY_LEAK_THRESHOLD: 0.8,
  MEMORY_TREND_THRESHOLD: 0.05,
  MEMORY_TREND_NEG_THRESHOLD: -0.05,
  MIN_TREND_SAMPLES: 3,

  // FPS calculations
  FPS_MIN: 0,
  FPS_MAX: 999,
} as const;

/**
 * Object pool size constants.
 */
export const POOL_CONSTANTS = {
  /** Standard initial pool size for objects. */
  DEFAULT_INITIAL_SIZE: 100,

  /** Standard maximum pool size for objects. */
  DEFAULT_MAX_SIZE: 10000,

  /** Initial size for Vector3 pool. */
  VECTOR3_INITIAL_SIZE: 500,

  /** Maximum size for Vector3 pool. */
  VECTOR3_MAX_SIZE: 5000,

  /** Initial size for Particle pool. */
  PARTICLE_INITIAL_SIZE: 2000,

  /** Maximum size for Particle pool. */
  PARTICLE_MAX_SIZE: 20000,
} as const;

/**
 * Particle system constants for visual effects.
 * Used in ParticleSystem for death/birth/eat/hunt effects.
 */
export const PARTICLE_CONSTANTS = {
  // Death effect parameters
  DEATH_COUNT_PREDATOR: 40,
  DEATH_COUNT_PREY: 25,
  DEATH_SPEED_PREDATOR: 3,
  DEATH_SPEED_PREY: 2,
  DEATH_SIZE_PREDATOR: 4,
  DEATH_SIZE_PREY: 3,
  DEATH_LIFE_MIN: 0.8,
  DEATH_LIFE_ADDITIONAL: 0.4,

  // Birth effect parameters
  BIRTH_COUNT_RING: 30,
  BIRTH_SPEED: 2,
  BIRTH_LIFE: 0.6,
  BIRTH_SIZE: 3,
  BIRTH_COUNT_FLASH: 10,
  BIRTH_FLASH_SPEED: 1,
  BIRTH_FLASH_SIZE: 5,
  BIRTH_FLASH_LIFE: 0.3,
  BIRTH_Y_VARIANCE: 0.5,

  // Eat effect parameters
  EAT_COUNT: 8,
  EAT_SPEED: 1.5,
  EAT_SIZE: 2,
  EAT_LIFE: 0.4,

  // Hunt effect parameters
  HUNT_STEPS: 5,
  HUNT_SPEED: 0.5,
  HUNT_SIZE: 2,
  HUNT_LIFE: 0.3,

  // Update physics constants
  FRAME_RATE_MULTIPLIER: 60,
  DRAG_COEFFICIENT: 0.98,
  GRAVITY: 0.02,
  SIZE_SCALE_MIN: 0.5,
  SIZE_SCALE_FACTOR: 0.5,

  // Trail system constants
  TRAIL_TELEPORT_THRESHOLD_SQ: 2500,
  TRAIL_OPACITY: 0.6,

  // Color bit manipulation
  COLOR_SHIFT_R: 16,
  COLOR_SHIFT_G: 8,
  COLOR_MASK: 255,
  COLOR_DIVISOR: 255,

  // Geometry constants
  TWO_PI: Math.PI * 2,
  SPHERE_PHI_MULTIPLIER: 2,
  SPHERE_RANDOM_OFFSET: 1,
  VELOCITY_CENTER_OFFSET: 0.5,

  // Particle initialization constants
  DEFAULT_OPACITY: 1,
  DEFAULT_MAX_LIFE: 1,
  WHITE_COLOR: 0xffffff,

  // 3D vector constants
  SCALAR_COMPONENTS: 1,
  VECTOR3_COMPONENTS: 3,  // x, y, z
  X_OFFSET: 0,
  Y_OFFSET: 1,
  Z_OFFSET: 2,
  VECTOR2_OFFSET: 2,      // For component calculations
} as const;
