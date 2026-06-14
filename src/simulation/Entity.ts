/**
 * Entropia 3D — Simulation environment entity models.
 *
 * Implements an academically correct class hierarchy for the following objects:
 * - Organisms (producers/prey and consumers/predators).
 * - Resource units (energy substrates/food).
 * - Structural obstacles (spatial anomalies).
 *
 * Uses Discriminated Unions to ensure strict typing during Pattern Matching.
 */

import {
  COLORS,
  ENTITY_CONSTANTS,
  FOOD_ENERGY_VALUE,
  GENETICS,
  INITIAL_ENERGY,
  MAX_ENERGY,
  PHYSICS,
  PREDATOR_SUBTYPES,
} from '@/config';
import { Random } from '@/core/utils/Random.utils';
import type {
  EntityId,
  FoodId,
  Genome,
  GenomeId,
  MutableVector3,
  ObstacleId,
  OrganismId,
  OrganismRenderData,
  PredatorGenome,
  PredatorSubtype,
  PreyGenome,
  Vector3,
} from '@/types';
import {
  createFoodId,
  createGenomeId,
  createObstacleId,
  createOrganismId,
  EntityType,
  isPreyGenome,
  OrganismState,
  vec3Zero,
} from '@/types';

import type { IEntity } from './interfaces/IEntity';
import { MathUtils } from './MathUtils.utils';

// ============================================================================
// ABSTRACT BASE ENTITY
// ============================================================================

/**
 * Fundamental abstract class for all objects in the virtual world.
 */
export abstract class Entity implements IEntity {
  public abstract readonly type: EntityType;
  public radius: number; // Added radius property to Entity

  constructor(
    public readonly id: EntityId,
    public position: MutableVector3
  ) {
    this.radius = 0; // Initialize radius, will be set by derived classes
  }
}

// ============================================================================
// ENERGY SUBSTRATE (FOOD)
// ============================================================================

/**
 * Energy crystal — primary source of nutrients for producers.
 *
 * Characteristics:
 * - Static spatial localization.
 * - Object elimination upon consumption.
 * - Presence of visual effects (rotation, brightness oscillation).
 */
export class Food extends Entity {
  public readonly type = EntityType.FOOD;
  public readonly energyValue: number;
  public readonly maxEnergy: number;
  public currentEnergy: number;
  public readonly baseRadius: number;
  public lastBiteTick: number;

  /** Initialization timestamp for animation synchronization. */
  public readonly spawnTime: number;

  /** Current status of object consumption. */
  public consumed = false;

  // eslint-disable-next-line max-params
  constructor(
    id: FoodId,
    position: MutableVector3,
    energyValue: number = FOOD_ENERGY_VALUE,
    spawnTime = Date.now()
  ) {
    super(id, position);
    this.baseRadius = ENTITY_CONSTANTS.FOOD_RADIUS;
    this.radius = this.baseRadius;
    this.energyValue = energyValue;
    this.maxEnergy = energyValue;
    this.currentEnergy = energyValue;
    this.lastBiteTick = Number.NEGATIVE_INFINITY;
    this.spawnTime = spawnTime;
  }

  public applyBite(requestedEnergy: number, tick: number): number {
    if (this.consumed || requestedEnergy <= 0) {
      return 0;
    }

    if (tick - this.lastBiteTick < ENTITY_CONSTANTS.FOOD_BITE_COOLDOWN_TICKS) {
      return 0;
    }

    this.lastBiteTick = tick;

    const absorbedEnergy = Math.min(this.currentEnergy, requestedEnergy);
    this.currentEnergy = Math.max(0, this.currentEnergy - absorbedEnergy);

    const energyRatio = this.maxEnergy > 0 ? this.currentEnergy / this.maxEnergy : 0;
    const clampedRatio = MathUtils.clampUnit(energyRatio);
    const radiusFactor = ENTITY_CONSTANTS.FOOD_MIN_RADIUS_FACTOR
      + (1 - ENTITY_CONSTANTS.FOOD_MIN_RADIUS_FACTOR) * clampedRatio;
    this.radius = this.baseRadius * radiusFactor;

    if (this.currentEnergy <= ENTITY_CONSTANTS.FOOD_REMOVAL_THRESHOLD) {
      this.consumed = true;
      this.currentEnergy = 0;
    }

    return absorbedEnergy;
  }

  /**
   * Static factory method for instantiating food objects.
   */
  // eslint-disable-next-line max-params
  public static create(idCounter: number, x: number, y: number, z: number): Food {
    return new Food(
      createFoodId(`food_${String(idCounter)}`),
      { x, y, z },
      FOOD_ENERGY_VALUE
    );
  }
}

// ============================================================================
// STRUCTURAL OBSTACLE (OBSTACLE)
// ============================================================================

/**
 * Spatial anomaly — an object that restricts free movement of agents.
 *
 * Characteristics:
 * - Static interaction character.
 * - Formation of repulsion vectors upon contact.
 * - Varied visual representation.
 */
export class Obstacle extends Entity {
  public readonly type = EntityType.OBSTACLE;
  public readonly color: number;
  public readonly opacity: number;

  /** Wireframe display mode activation flag. */
  public readonly isWireframe: boolean;

  // eslint-disable-next-line max-params
  constructor(
    id: ObstacleId,
    position: MutableVector3,
    radius: number,
    color: number,
    opacity: number,
    isWireframe = false
  ) {
    super(id, position);
    this.radius = radius; // Set radius in derived class
    this.color = color;
    this.opacity = opacity;
    this.isWireframe = isWireframe;
  }

  /**
   * Static factory method for generating spatial anomaly objects.
   */
  // eslint-disable-next-line max-params
  public static create(
    idCounter: number,
    x: number,
    y: number,
    z: number,
    radius: number
  ): Obstacle {
    const rand = () => Random.next();
    return new Obstacle(
      createObstacleId(`obs_${String(idCounter)}`),
      { x, y, z },
      radius,
      COLORS.obstacle.base + Math.floor(rand() * ENTITY_CONSTANTS.OBSTACLE_COLOR_VARIANCE),
      ENTITY_CONSTANTS.OBSTACLE_OPACITY_MIN + rand() * ENTITY_CONSTANTS.OBSTACLE_OPACITY_VARIANCE,
      rand() > ENTITY_CONSTANTS.OBSTACLE_WIREFRAME_THRESHOLD
    );
  }
}

// ============================================================================
// BIOLOGICAL AGENT (ORGANISM)
// ============================================================================

/**
 * Dynamic simulation unit possessing a genome, metabolism, and behavioral logic.
 *
 * Implemented mechanisms:
 * - Kinematic modeling (velocity and acceleration vectors).
 * - Thermodynamic metabolism (energy dissipation).
 * - Finite State Machine (IDLE, SEEKING, FLEEING, etc.).
 * - Genetic code preservation and transmission.
 */
export class Organism extends Entity {
  public readonly type: typeof EntityType.PREY | typeof EntityType.PREDATOR;

  // Kinematic characteristics
  public velocity: MutableVector3;
  public acceleration: MutableVector3;

  // Vital functions and state description
  public energy: number;
  public age = 0;
  public state: OrganismState = OrganismState.IDLE;
  public isDead = false;
  public causeOfDeath: 'starvation' | 'predation' | 'old_age' | null = null;

  // Visual attributes
  public trailEnabled = false;
  public color: number; // Added color property to Organism
  public mass: number; // Added mass property to Organism
  public targetPosition: MutableVector3; // Added targetPosition property to Organism
  public readonly adultRadius: number;
  public growthRatio: number;
  public maturityRatio: number;
  public stuckTicks: number;

  // Genetic descriptor
  public readonly genome: Genome;

  /** Reference to ancestor identifier (for phylogenetic analysis). */
  public readonly parentOrganismId: OrganismId | null;

  /** Register of successful trophic interactions (relevant for predators). */
  public huntSuccessCount = 0;

  /** Last activity timestamp for update optimization. */
  public lastActiveAt = 0;

  // eslint-disable-next-line max-params
  constructor(id: OrganismId, position: { x: number; y: number; z: number }, genome: Genome, parentId: OrganismId | null = null, energy?: number) {
    super(id, position);
    this.genome = genome;
    this.type = genome.type;
    this.parentOrganismId = parentId;
    this.energy = energy ?? INITIAL_ENERGY;
    this.adultRadius = genome.size;
    this.growthRatio = ENTITY_CONSTANTS.NEWBORN_RADIUS_FACTOR;
    this.maturityRatio = 0;
    this.radius = this.adultRadius * this.growthRatio;
    this.mass = this.radius;
    this.stuckTicks = 0;
    this.targetPosition = { ...position };
    this.color = genome.color;

    // Initialization of kinematic vectors of physical interaction
    this.velocity = {
      x: (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.VELOCITY_RANGE,
      y: (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.VELOCITY_RANGE,
      z: (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.VELOCITY_RANGE,
    };
    this.acceleration = vec3Zero();
    this.updateGrowthFromState();
  }

  /** Checking belonging to trophic level of producers/herbivores. */
  public get isPrey(): boolean {
    return this.type === EntityType.PREY;
  }

  /** Checking belonging to trophic level of consumers/predators. */
  public get isPredator(): boolean {
    return this.type === EntityType.PREDATOR;
  }

  /** Calculation of normalized energy reserve value [0, 1]. */
  public get normalizedEnergy(): number {
    return MathUtils.clampUnit(this.energy / MAX_ENERGY);
  }

  /** Calculation of scalar velocity magnitude (vector magnitude). */
  public get speed(): number {
    return Math.sqrt(
      this.velocity.x * this.velocity.x +
      this.velocity.y * this.velocity.y +
      this.velocity.z * this.velocity.z
    );
  }

  /** Replenishing organism's energy depot. */
  public addEnergy(amount: number): void {
    this.energy = Math.min(MAX_ENERGY, this.energy + amount);
    this.updateGrowthFromState();
  }

  /** Energy dissipation and critical exhaustion level check. */
  public consumeEnergy(amount: number): void {
    this.energy -= amount;
    this.updateGrowthFromState();
    if (this.energy <= 0) {
      this.die('starvation');
    }
  }

  public updateGrowthFromState(): void {
    const maturity = MathUtils.clampUnit(this.age / ENTITY_CONSTANTS.GROWTH_AGE_CAP_TICKS);
    this.maturityRatio = maturity;

    const normalizedEnergy = MathUtils.clampUnit(this.energy / MAX_ENERGY);

    const penalty = ENTITY_CONSTANTS.GROWTH_ENERGY_PENALTY_THRESHOLD;
    const recovery = ENTITY_CONSTANTS.GROWTH_ENERGY_RECOVERY_THRESHOLD;
    const energyWindow = Math.max(PHYSICS.EPSILON, recovery - penalty);
    const energyGrowth = MathUtils.clampUnit((normalizedEnergy - penalty) / energyWindow);

    const growthWindow = maturity * energyGrowth;
    this.growthRatio = ENTITY_CONSTANTS.NEWBORN_RADIUS_FACTOR + (1 - ENTITY_CONSTANTS.NEWBORN_RADIUS_FACTOR) * growthWindow;
    this.radius = this.adultRadius * this.growthRatio;
    this.mass = this.radius;
  }

  /** Initialization of terminal elimination process (death). */
  public die(cause: 'starvation' | 'predation' | 'old_age'): void {
    if (!this.isDead) {
      this.isDead = true;
      this.causeOfDeath = cause;
      this.state = OrganismState.DYING;
      // Obtaining random offset for death visualization
      // Fixed: Use this.rng.next() instead of static Random.next()
      this.position.x += (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.DEATH_POSITION_RANGE;
      this.position.y += (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.DEATH_POSITION_RANGE;
      this.position.z += (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.DEATH_POSITION_RANGE;
    }
  }

  /** Validated agent internal state change. */
  public updateState(newState: OrganismState): void {
    if (!this.isDead && this.state !== newState) {
      this.state = newState;
    }
  }

  /** Forming immutable data snapshot for visualization subsystem. */
  public toRenderData(): OrganismRenderData {
    return {
      id: this.id as OrganismId,
      position: { ...this.position } as Vector3,
      velocity: { ...this.velocity } as Vector3,
      radius: this.radius,
      adultRadius: this.adultRadius,
      growthRatio: this.growthRatio,
      maturityRatio: this.maturityRatio,
      stuckTicks: this.stuckTicks,
      energy: this.energy,
      maxEnergy: MAX_ENERGY,
      type: this.type,
      state: this.state,
      genome: this.genome,
      trailEnabled: this.trailEnabled,
      age: this.age,
    };
  }
}

// ============================================================================
// GENETIC STRUCTURE GENERATOR (GENOME FACTORY)
// ============================================================================

/**
 * Center for genome formation with stochastic mutation support.
 */
export class GenomeFactory {
  private idCounter = 0;

  /** Generating a unique genome descriptor. */
  private nextId(): GenomeId {
    return createGenomeId(`genome_${String(++this.idCounter)}`);
  }

  public getIdCounter(): number {
    return this.idCounter;
  }

  public setIdCounter(counter: number): void {
    this.idCounter = Math.max(0, counter);
  }

  /**
   * Unified genetic trait mutation method with boundary validation.
   */
  // eslint-disable-next-line max-params
  private mutateTrait(value: number, min: number, max: number, customFactor = 1): number {
    const mf = GENETICS.mutationFactor * customFactor;
    const factor = 1 - mf / ENTITY_CONSTANTS.MUTATION_DIVISOR + Random.next() * mf;
    return Math.max(min, Math.min(max, value * factor));
  }

  /**
   * Mutation of common traits for all genome types.
   */
  private mutateCommonTraits(parent: Genome) {
    const min = GENETICS.min;
    const max = GENETICS.max;
    return {
      maxSpeed: this.mutateTrait(parent.maxSpeed, min.maxSpeed, max.maxSpeed),
      senseRadius: this.mutateTrait(parent.senseRadius, min.senseRadius, max.senseRadius),
      metabolism: this.mutateTrait(parent.metabolism, min.metabolism, max.metabolism),
      size: this.mutateTrait(parent.size, min.size, max.size),
      asymmetry: this.mutateTrait(parent.asymmetry, min.asymmetry, max.asymmetry, ENTITY_CONSTANTS.TRAIT_MUTATION_FACTOR),
      spikiness: this.mutateTrait(parent.spikiness, min.spikiness, max.spikiness, ENTITY_CONSTANTS.TRAIT_MUTATION_FACTOR),
      glowIntensity: this.mutateTrait(parent.glowIntensity, min.glowIntensity, max.glowIntensity),
    };
  }

  /** Genome formation for trophic level of herbivores. */
  public createPreyGenome(parent: PreyGenome | null = null): PreyGenome {
    if (!parent) {
      const base = GENETICS.preyBase;
      return {
        id: this.nextId(),
        parentId: null,
        generation: 1,
        type: EntityType.PREY,
        color: COLORS.prey.base,
        maxSpeed: base.maxSpeed + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREY_SPEED_VARIANCE,
        senseRadius: base.senseRadius + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREY_SENSE_VARIANCE,
        metabolism: base.metabolism + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREY_METABOLISM_VARIANCE,
        size: base.size + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREY_SIZE_VARIANCE,
        asymmetry: Random.next() * ENTITY_CONSTANTS.PREY_ASYMMETRY_MAX,
        spikiness: Random.next() * ENTITY_CONSTANTS.PREY_SPIKINESS_MAX,
        glowIntensity: ENTITY_CONSTANTS.PREY_GLOW_MIN + Random.next() * ENTITY_CONSTANTS.PREY_GLOW_VARIANCE,
        flockingStrength: base.flockingStrength + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREY_FLOCKING_VARIANCE,
      };
    }

    const genome: PreyGenome = {
      ...this.mutateCommonTraits(parent),
      type: EntityType.PREY,
      id: this.nextId(),
      parentId: parent.id,
      generation: parent.generation + 1,
      color: COLORS.prey.base,
      flockingStrength: this.mutateTrait(parent.flockingStrength || ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET, ENTITY_CONSTANTS.TRAIT_MIN_BOUND, ENTITY_CONSTANTS.TRAIT_MAX_BOUND),
    };
    return genome;
  }

  /** Genome formation for trophic level of predators. */
  public createPredatorGenome(parent: PredatorGenome | null = null): PredatorGenome {
    const subtypes: PredatorSubtype[] = ['HUNTER', 'AMBUSHER', 'PACK'];
    const randomSubtype = subtypes[Math.floor(Random.next() * subtypes.length)] ?? 'HUNTER';

    if (!parent) {
      const base = GENETICS.predatorBase;
      const subConfig = PREDATOR_SUBTYPES[randomSubtype];
      return {
        id: this.nextId(),
        parentId: null,
        generation: 1,
        type: EntityType.PREDATOR,
        subtype: randomSubtype,
        color: subConfig.color,
        maxSpeed: base.maxSpeed * subConfig.speedMultiplier + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREDATOR_SPEED_VARIANCE,
        senseRadius: base.senseRadius * subConfig.senseMultiplier + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREDATOR_SENSE_VARIANCE,
        metabolism: base.metabolism + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREDATOR_METABOLISM_VARIANCE,
        size: base.size + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREDATOR_SIZE_VARIANCE,
        asymmetry: Random.next() * ENTITY_CONSTANTS.PREDATOR_ASYMMETRY_MAX,
        spikiness: ENTITY_CONSTANTS.PREDATOR_SPIKINESS_MIN + Random.next() * ENTITY_CONSTANTS.PREDATOR_SPIKINESS_VARIANCE,
        glowIntensity: ENTITY_CONSTANTS.PREDATOR_GLOW_MIN + Random.next() * ENTITY_CONSTANTS.PREDATOR_GLOW_VARIANCE,
        attackPower: base.attackPower * subConfig.attackMultiplier,
        packAffinity: base.packAffinity + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * ENTITY_CONSTANTS.PREDATOR_PACK_VARIANCE,
      };
    }

    // Evolutionary inheritance and probabilistic subtype transformation with 90% coefficient
    const inheritedSubtype = Random.next() < ENTITY_CONSTANTS.SUBTYPE_INHERITANCE_PROBABILITY ? parent.subtype : randomSubtype;
    const subConfig = PREDATOR_SUBTYPES[inheritedSubtype];

    const genome: PredatorGenome = {
      ...this.mutateCommonTraits(parent),
      id: this.nextId(),
      parentId: parent.id,
      generation: parent.generation + 1,
      type: EntityType.PREDATOR,
      subtype: inheritedSubtype,
      color: subConfig.color,
      attackPower: this.mutateTrait(parent.attackPower, ENTITY_CONSTANTS.TRAIT_MIN_ATTACK, ENTITY_CONSTANTS.TRAIT_MAX_ATTACK),
      packAffinity: this.mutateTrait(parent.packAffinity, ENTITY_CONSTANTS.TRAIT_MIN_BOUND, ENTITY_CONSTANTS.TRAIT_MAX_BOUND),
    };
    return genome;
  }

  /** Generating a new genome based on an existing ancestor. */
  public createFromParent(parentGenome: Genome): Genome {
    if (isPreyGenome(parentGenome)) {
      return this.createPreyGenome(parentGenome);
    } else {
      return this.createPredatorGenome(parentGenome);
    }
  }

  /** Reset internal identifier counters. */
  public reset(): void {
    this.idCounter = 0;
  }
}

// ============================================================================
// ORGANISM FACTORY
// ============================================================================

/**
 * Control center for creating and configuring living agents.
 */
export class OrganismFactory {
  private idCounter = 0;
  private readonly genomeFactory: GenomeFactory;

  constructor() {
    this.genomeFactory = new GenomeFactory();
  }

  /** Generating a unique system identifier for the agent. */
  private nextId(): OrganismId {
    return createOrganismId(`org_${String(++this.idCounter)}`);
  }

  public getIdCounter(): number {
    return this.idCounter;
  }

  public setIdCounter(counter: number): void {
    this.idCounter = Math.max(0, counter);
  }

  public getGenomeIdCounter(): number {
    return this.genomeFactory.getIdCounter();
  }

  public setGenomeIdCounter(counter: number): void {
    this.genomeFactory.setIdCounter(counter);
  }

  /** Creating primary instance of herbivore organism. */
  public createPrey(x: number, y: number, z: number): Organism {
    return this.createOrganism(
      this.genomeFactory.createPreyGenome(),
      { x, y, z }
    );
  }

  /** Creating primary instance of predator organism. */
  public createPredator(x: number, y: number, z: number): Organism {
    return this.createOrganism(
      this.genomeFactory.createPredatorGenome(),
      { x, y, z }
    );
  }

  private createOrganism(genome: Genome, position: { x: number, y: number, z: number }, energy?: number): Organism {
    return new Organism(this.nextId(), position, genome, null, energy);
  }

  /** Initiating offspring creation with inheritance and coordinate offset. */
  public createOffspring(parent: Organism, energy: number): Organism {
    const childGenome = this.genomeFactory.createFromParent(parent.genome);

    // Stochastic spatial offset of the offspring relative to the parent organism's location
    const offset = parent.radius * ENTITY_CONSTANTS.OFFSPRING_RADIUS_MULTIPLIER;
    const childPosition: MutableVector3 = {
      x: parent.position.x + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * offset,
      y: parent.position.y + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * offset,
      z: parent.position.z + (Random.next() - ENTITY_CONSTANTS.RANDOM_CENTER_OFFSET) * offset,
    };

    return new Organism(
      this.nextId(),
      childPosition,
      childGenome,
      parent.id as OrganismId,
      energy
    );
  }

  /** Full factory state clear. */
  public reset(): void {
    this.idCounter = 0;
    this.genomeFactory.reset();
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPrey(entity: Entity): entity is Organism {
  return entity.type === EntityType.PREY;
}

export function isPredator(entity: Entity): entity is Organism {
  return entity.type === EntityType.PREDATOR;
}
