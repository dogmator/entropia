/**
 * Entropia 3D — Population flow management service (SpawnService).
 *
 * Centralized component responsible for object initialization and replication:
 * - Calculation of optimal spatial coordinates for new agents.
 * - Considering environmental ecological structure (biomes and zones).
 * - Control of spatial collisions with existing obstacles.
 * - Implementation of flexible species dispersal strategies.
 */

import { INITIAL_ENERGY, WORLD_SIZE } from '@/config';
import type { EventBus } from '@/core/EventBus.service';
import { Random } from '@/core/utils/Random.utils';
import type {
  EcologicalZone,
  EntitySpawnedEvent,
  FoodId,
  GridEntity,
  MutableVector3,
  OrganismId,
  Vector3,
  WorldConfig
} from '@/types.ts';
import {
  EntityType,
} from '@/types.ts';

import type { Obstacle, Organism } from '../Entity';
import { Food, OrganismFactory } from '../Entity';
import type { GridManager } from '../managers/GridManager.manager';
import { MathUtils } from '../MathUtils.utils';
import { isPositionBlockedByAnomalies } from '../utils/AnomalyValidation';

// ============================================================================
// LOCAL CONSTANTS
// ============================================================================

/** Minimum distance from anomalies for a valid food position. */
const FOOD_MIN_OBSTACLE_DISTANCE = 5;
/** Probability of choosing an oasis when spawning food. */
const OASIS_SPAWN_PROBABILITY = 0.3;
/** Search radius for neighboring objects for cluster spawn. */
const CLUSTER_SEARCH_RADIUS = 50;
/** Minimum spread distance from cluster center. */
const CLUSTER_MIN_SPREAD = 5;
/** Additional maximum spread distance from cluster center. */
const CLUSTER_MAX_SPREAD_DELTA = 15;
/** Number of attempts to find position in a zone. */
const ZONE_POSITION_ATTEMPTS = 20;
/** Uniform grid size (number of cells along each axis). */
const UNIFORM_GRID_DIVISIONS = 10;
/** Constant for uniform distribution on sphere (spherical sampling). */
const SPHERICAL_SAMPLE_SCALE = 2;

// ============================================================================
// ENUMS AND CONFIGURATION OBJECTS
// ============================================================================

/**
 * Spatial distribution strategies for energy substrates (food).
 */
export enum FoodSpawnStrategy {
  /** Stochastic uniform placement throughout the volume. */
  RANDOM = 'random',
  /** Priority placement in oases (high probability of concentration). */
  OASIS_PREFERRED = 'oasis_preferred',
  /** Formation of local clusters (aggregated dispersal). */
  CLUSTERED = 'clustered',
  /** Regular (grid) placement. */
  UNIFORM = 'uniform',
}

/**
 * Territorial expansion strategies for biological agents.
 */
export enum OrganismSpawnStrategy {
  /** Random position initialization. */
  RANDOM = 'random',
  /** Ecologically determined dispersal (prey in safe zones, predators in hunting grounds). */
  ECOLOGICAL = 'ecological',
  /** Uniform space filling. */
  UNIFORM = 'uniform',
}

/**
 * Initialization service configuration parameters.
 */
export interface SpawnConfig {
  /** Chosen food distribution model. */
  foodStrategy: FoodSpawnStrategy;
  /** Chosen organism dispersal model. */
  organismStrategy: OrganismSpawnStrategy;
  /** Minimum allowable distance to structural anomalies. */
  minObstacleDistance: number;
  /** Spatial separation threshold between agents upon initialization. */
  minOrganismDistance: number;
  /** Limit on iterations for finding a valid location. */
  maxSpawnAttempts: number;
}

/**
 * Default configuration values (base environment settings).
 */
const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  foodStrategy: FoodSpawnStrategy.OASIS_PREFERRED,
  organismStrategy: OrganismSpawnStrategy.ECOLOGICAL,
  minObstacleDistance: 15,
  minOrganismDistance: 10,
  maxSpawnAttempts: 50,
};

// ============================================================================
// SERVICE IMPLEMENTATION (SPAWN SERVICE)
// ============================================================================

/**
 * Class encapsulating the logic of filling the world with objects.
 */
export class SpawnService {
  private readonly config: SpawnConfig;
  private readonly organismFactory: OrganismFactory;

  private rand(): number {
    return Random.next();
  }

  // eslint-disable-next-line max-params
  constructor(
    private readonly eventBus: EventBus,
    private readonly gridManager: GridManager,
    private readonly zones: Map<string, EcologicalZone>,
    private readonly obstacles: Map<string, Obstacle>,
    config?: Partial<SpawnConfig>,
    private readonly worldConfig?: WorldConfig
  ) {
    this.config = { ...DEFAULT_SPAWN_CONFIG, ...config };
    this.organismFactory = new OrganismFactory();
  }

  // ============================================================================
  // ORGANISM MANAGEMENT
  // ============================================================================

  // Helper getter for WorldSize
  private get worldSize(): number {
    return this.worldConfig?.WORLD_SIZE ?? WORLD_SIZE;
  }

  /**
   * Performs creation and registration of a new biological agent.
   */
  public spawnOrganism(
    type: EntityType,
    parent?: Organism
  ): Organism | null {
    const position = this.getOrganismSpawnPosition(type);
    if (!position) { return null; }

    let organism: Organism;

    if (parent) {
      organism = this.organismFactory.createOffspring(parent, INITIAL_ENERGY);
      organism.position.x = position.x;
      organism.position.y = position.y;
      organism.position.z = position.z;
    } else if (type === EntityType.PREY) {
      organism = this.organismFactory.createPrey(position.x, position.y, position.z);
    } else {
      organism = this.organismFactory.createPredator(position.x, position.y, position.z);
    }

    // Broadcast event about successful entity creation
    this.eventBus.emit({
      type: 'EntitySpawned',
      entityType: organism.type,
      id: organism.id as OrganismId,
      position: { ...organism.position },
      parentId: parent?.id as OrganismId | undefined,
    } as EntitySpawnedEvent);

    return organism;
  }

  /**
   * Calculation of optimal spawn location according to chosen strategy.
   */
  private getOrganismSpawnPosition(type: EntityType): MutableVector3 | null {
    switch (this.config.organismStrategy) {
      case OrganismSpawnStrategy.ECOLOGICAL:
        return this.getEcologicalPosition(type);

      case OrganismSpawnStrategy.UNIFORM:
        return this.getUniformPosition();

      case OrganismSpawnStrategy.RANDOM:
      default:
        return this.getRandomValidPosition(this.config.minOrganismDistance, true);
    }
  }

  /**
   * Determining position based on ecological preferences of the species.
   */
  private getEcologicalPosition(_type: EntityType): MutableVector3 | null {
    return this.getRandomValidPosition(this.config.minOrganismDistance, true);
  }

  // ============================================================================
  // RESOURCE UNIT MANAGEMENT (FOOD)
  // ============================================================================

  /**
   * Initialization of food object creation.
   */
  public spawnFood(foodIdCounter: number): Food | null {
    const position = this.getFoodSpawnPosition();
    if (!position) { return null; }

    const food = Food.create(foodIdCounter, position.x, position.y, position.z);

    // System notification about new resource appearance
    this.eventBus.emit({
      type: 'EntitySpawned',
      entityType: EntityType.FOOD,
      id: food.id as unknown as FoodId,
      position: { ...position },
    } as EntitySpawnedEvent);

    return food;
  }

  /**
   * Determining food placement location according to strategy.
   */
  private getFoodSpawnPosition(): MutableVector3 | null {
    const preferredPosition = this.getRawFoodSpawnPosition();
    if (preferredPosition && this.isValidFoodPosition(preferredPosition)) {
      return preferredPosition;
    }

    return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true);
  }

  /**
   * Determining desired food location according to strategy.
   */
  private getRawFoodSpawnPosition(): MutableVector3 | null {
    switch (this.config.foodStrategy) {
      case FoodSpawnStrategy.OASIS_PREFERRED:
        return this.getOasisPreferredPosition();
      case FoodSpawnStrategy.CLUSTERED:
        return this.getClusteredPosition();
      case FoodSpawnStrategy.UNIFORM:
        return this.getUniformPosition();
      case FoodSpawnStrategy.RANDOM:
      default:
        return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true);
    }
  }

  /**
   * Resource formation with increased density in oasis area.
   */
  private getOasisPreferredPosition(): MutableVector3 | null {
    if (this.rand() < OASIS_SPAWN_PROBABILITY) {
      const oasis = this.zones.get('oasis_center');
      if (oasis) {
        const pos = this.getPositionInZone(oasis);
        if (pos && this.isValidFoodPosition(pos)) {
          return pos;
        }
      }
    }
    return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true);
  }

  /** Cached neighbor buffer to avoid allocations. */
  private readonly nearbyBuffer: GridEntity[] = [];

  /**
   * Creating new resources near existing ones (cluster effect).
   */
  private getClusteredPosition(): MutableVector3 | null {
    const ws = this.worldSize;
    this.gridManager.getNearby(
      {
        x: this.rand() * ws,
        y: this.rand() * ws,
        z: this.rand() * ws,
      },
      CLUSTER_SEARCH_RADIUS,
      this.nearbyBuffer
    );

    const foodEntities = this.nearbyBuffer.filter(e => e.type === EntityType.FOOD);
    if (foodEntities.length > 0) {
      const target = foodEntities[Math.floor(this.rand() * foodEntities.length)];
      if (!target) { return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true); }
      const angle = this.rand() * Math.PI * SPHERICAL_SAMPLE_SCALE;
      const phi = Math.acos(SPHERICAL_SAMPLE_SCALE * this.rand() - 1);
      const r = CLUSTER_MIN_SPREAD + this.rand() * CLUSTER_MAX_SPREAD_DELTA;

      const pos: MutableVector3 = {
        x: MathUtils.wrap(target.position.x + r * Math.sin(phi) * Math.cos(angle), ws),
        y: MathUtils.wrap(target.position.y + r * Math.sin(phi) * Math.sin(angle), ws),
        z: MathUtils.wrap(target.position.z + r * Math.cos(phi), ws),
      };

      if (this.isValidFoodPosition(pos)) {
        return pos;
      }
    }

    return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true);
  }

  // ============================================================================
  // TECHNICAL AND VALIDATION METHODS
  // ============================================================================

  /**
   * Random coordinate generation with repeated validity checks.
   */
  private getRandomValidPosition(minDistance: number, avoidZones = false): MutableVector3 | null {
    for (let attempt = 0; attempt < this.config.maxSpawnAttempts; attempt++) {
      const ws = this.worldSize;
      const pos: MutableVector3 = {
        x: this.rand() * ws,
        y: this.rand() * ws,
        z: this.rand() * ws,
      };

      if (this.isValidPosition(pos, minDistance, avoidZones)) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Coordinate formation based on regular discrete grid.
   */
  private getUniformPosition(): MutableVector3 | null {
    const ws = this.worldSize;
    const gridSize = UNIFORM_GRID_DIVISIONS;
    const cellSize = ws / gridSize;

    const cellX = Math.floor(this.rand() * gridSize);
    const cellY = Math.floor(this.rand() * gridSize);
    const cellZ = Math.floor(this.rand() * gridSize);

    const pos: MutableVector3 = {
      x: cellX * cellSize + this.rand() * cellSize,
      y: cellY * cellSize + this.rand() * cellSize,
      z: cellZ * cellSize + this.rand() * cellSize,
    };

    if (this.isValidFoodPosition(pos)) {
      return pos;
    }

    return this.getRandomValidPosition(FOOD_MIN_OBSTACLE_DISTANCE, true);
  }

  /**
   * Point generation inside specified spherical volume (biome).
   */
  private getPositionInZone(zone: EcologicalZone): MutableVector3 | null {
    for (let attempt = 0; attempt < ZONE_POSITION_ATTEMPTS; attempt++) {
      const angle = this.rand() * Math.PI * SPHERICAL_SAMPLE_SCALE;
      const phi = Math.acos(SPHERICAL_SAMPLE_SCALE * this.rand() - 1);
      const r = this.rand() * zone.radius;

      const pos: MutableVector3 = {
        x: zone.center.x + r * Math.sin(phi) * Math.cos(angle),
        y: zone.center.y + r * Math.sin(phi) * Math.sin(angle),
        z: zone.center.z + r * Math.cos(phi),
      };

      pos.x = MathUtils.wrap(pos.x, this.worldSize);
      pos.y = MathUtils.wrap(pos.y, this.worldSize);
      pos.z = MathUtils.wrap(pos.z, this.worldSize);

      if (this.isValidPosition(pos, this.config.minOrganismDistance)) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Point validation for collisions with spatial anomalies.
   */
  private isValidPosition(pos: Vector3, minDistance: number, avoidZones = false): boolean {
    return !isPositionBlockedByAnomalies({
      position: pos,
      obstacles: this.obstacles.values(),
      zones: this.zones.values(),
      worldSize: this.worldSize,
      obstaclePadding: minDistance,
      zonePadding: minDistance,
      checkZones: avoidZones,
    });
  }

  private isValidFoodPosition(pos: Vector3): boolean {
    return this.isValidPosition(pos, FOOD_MIN_OBSTACLE_DISTANCE, true);
  }

  /**
   * Full reset of internal state of organism factories.
   */
  public resetFactory(): void {
    this.organismFactory.reset();
  }

  /**
   * Access to factory instance for external manipulations.
   */
  public getFactory(): OrganismFactory {
    return this.organismFactory;
  }
}
