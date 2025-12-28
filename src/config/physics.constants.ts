/**
 * Physical models and interaction parameters.
 * Boids algorithms and steering behavior implementation.
 */

/** Standard physics update frequency (FPS). */
const PHYSICS_TICK_RATE = 60;

export const PHYSICS = {
  /** Discrete integration step in time domain. */
  dt: 1 / PHYSICS_TICK_RATE,

  /** Dynamic resistance (viscosity) coefficient of virtual medium. */
  drag: 0.96,

  /** Separation force coefficient (minimizing spatial collisions). */
  separationWeight: 2.5,

  /** Alignment force coefficient (modeling group coherence). */
  alignmentWeight: 1.2,

  /** Cohesion force coefficient (attraction to geometric center of group). */
  cohesionWeight: 1.0,

  /** Priority of seeking vector towards target object (resource/prey). */
  seekWeight: 3.5,

  /** Priority of avoidance vector from threats (predator/geometric obstacle). */
  avoidWeight: 3.5,

  /** Maximum allowed steering force magnitude. */
  maxSteeringForce: 0.5,

  /** Buffer stride for organisms (x, y, z, vx, vy, vz, r, type, id, state, energy, age, health) */
  ORGANISM_STRIDE: 13,

  /** Buffer stride for food (x, y, z, r, id) */
  FOOD_STRIDE: 5,

  /** Radius of separation force action zone. */
  separationRadius: 18,

  /** Distance to start avoiding obstacles. */
  obstacleAvoidanceDistance: 25,

  /** Small value to prevent division by zero. */
  EPSILON: 0.001,

  /** Collision search radius offset. */
  COLLISION_SEARCH_RADIUS_OFFSET: 20,

  /** Obstacle avoidance force weight. */
  OBSTACLE_AVOIDANCE_WEIGHT: 12,
} as const;

export const INTERACTION = {
  /** Energy dissipation coefficient when bouncing off obstacles (0.8 = 20% loss). */
  obstacleBounceDamping: 0.8,

  /** Spatial correction (push) force modifier to prevent getting stuck. */
  obstaclePushMultiplier: 1.1,

  /** Predator energy assimilation efficiency when consuming prey. */
  predatorEnergyEfficiency: 0.6,

  /** Guaranteed minimum energy gain during hunting. */
  minEnergyGain: 25,
} as const;
