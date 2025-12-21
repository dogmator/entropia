/**
 * Entropia 3D — SpawnService
 *
 * Централізований сервіс для spawn-логіки з:
 * - Інтелектуальним розміщенням організмів
 * - Урахуванням екологічних зон
 * - Запобіганням оверлапу з перешкодами
 * - Підтримкою різних стратегій спавну
 */

import {
  EntityType,
  OrganismId,
  FoodId,
  Vector3,
  MutableVector3,
  EcologicalZone,
  ZoneType,
  EntitySpawnedEvent,
} from '../../types';
import { WORLD_SIZE } from '../../constants';
import { Organism, Food, Obstacle, OrganismFactory } from '../Entity';
import { EventBus } from '../../core/EventBus';
import { SpatialHashGrid } from '../SpatialHashGrid';
import { MathUtils } from '../MathUtils';

// ============================================================================
// ТИПИ
// ============================================================================

/**
 * Стратегія спавну їжі
 */
export enum FoodSpawnStrategy {
  /** Випадкове розміщення */
  RANDOM = 'random',
  /** Переважно в оазисах (30% ймовірність) */
  OASIS_PREFERRED = 'oasis_preferred',
  /** Кластерне розміщення */
  CLUSTERED = 'clustered',
  /** Рівномірний розподіл */
  UNIFORM = 'uniform',
}

/**
 * Стратегія спавну організмів
 */
export enum OrganismSpawnStrategy {
  /** Випадкове розміщення */
  RANDOM = 'random',
  /** Жертви в безпечних зонах, хижаки навколо */
  ECOLOGICAL = 'ecological',
  /** Рівномірний розподіл */
  UNIFORM = 'uniform',
}

/**
 * Конфігурація SpawnService
 */
export interface SpawnConfig {
  /** Стратегія спавну їжі */
  foodStrategy: FoodSpawnStrategy;
  /** Стратегія спавну організмів */
  organismStrategy: OrganismSpawnStrategy;
  /** Мінімальна дистанція від перешкод */
  minObstacleDistance: number;
  /** Мінімальна дистанція між організмами при spawn */
  minOrganismDistance: number;
  /** Максимум спроб знайти валідну позицію */
  maxSpawnAttempts: number;
}

/**
 * Дефолтна конфігурація
 */
const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  foodStrategy: FoodSpawnStrategy.OASIS_PREFERRED,
  organismStrategy: OrganismSpawnStrategy.ECOLOGICAL,
  minObstacleDistance: 15,
  minOrganismDistance: 10,
  maxSpawnAttempts: 50,
};

// ============================================================================
// SPAWN SERVICE
// ============================================================================

export class SpawnService {
  private readonly config: SpawnConfig;
  private readonly organismFactory: OrganismFactory = new OrganismFactory();

  constructor(
    private readonly eventBus: EventBus,
    private readonly spatialGrid: SpatialHashGrid,
    private readonly zones: Map<string, EcologicalZone>,
    private readonly obstacles: Map<string, Obstacle>,
    config?: Partial<SpawnConfig>
  ) {
    this.config = { ...DEFAULT_SPAWN_CONFIG, ...config };
  }

  // ============================================================================
  // SPAWN ОРГАНІЗМІВ
  // ============================================================================

  /**
   * Створити новий організм
   */
  spawnOrganism(
    type: EntityType,
    parent?: Organism
  ): Organism | null {
    const position = this.getOrganismSpawnPosition(type);
    if (!position) return null;

    let organism: Organism;

    if (parent) {
      organism = this.organismFactory.createOffspring(parent);
      organism.position.x = position.x;
      organism.position.y = position.y;
      organism.position.z = position.z;
    } else if (type === EntityType.PREY) {
      organism = this.organismFactory.createPrey(position.x, position.y, position.z);
    } else {
      organism = this.organismFactory.createPredator(position.x, position.y, position.z);
    }

    // Відправити подію
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
   * Отримати позицію для спавну організму
   */
  private getOrganismSpawnPosition(type: EntityType): MutableVector3 | null {
    switch (this.config.organismStrategy) {
      case OrganismSpawnStrategy.ECOLOGICAL:
        return this.getEcologicalPosition(type);

      case OrganismSpawnStrategy.UNIFORM:
        return this.getUniformPosition();

      case OrganismSpawnStrategy.RANDOM:
      default:
        return this.getRandomValidPosition(this.config.minOrganismDistance);
    }
  }

  /**
   * Екологічна позиція (жертви в sanctuary, хижаки навколо)
   */
  private getEcologicalPosition(type: EntityType): MutableVector3 | null {
    if (type === EntityType.PREY) {
      // Жертви переважно в sanctuary або біля oasis
      const sanctuary = this.zones.get('sanctuary');
      if (sanctuary && Math.random() < 0.4) {
        return this.getPositionInZone(sanctuary);
      }
      const oasis = this.zones.get('oasis_center');
      if (oasis && Math.random() < 0.4) {
        return this.getPositionInZone(oasis);
      }
    } else {
      // Хижаки переважно в hunting_ground або в пустелі
      const huntingGround = this.zones.get('hunting_ground');
      if (huntingGround && Math.random() < 0.4) {
        return this.getPositionInZone(huntingGround);
      }
      const desert = this.zones.get('desert_0');
      if (desert && Math.random() < 0.3) {
        return this.getPositionInZone(desert);
      }
    }

    // Fallback до випадкової валідної позиції
    return this.getRandomValidPosition(this.config.minOrganismDistance);
  }

  // ============================================================================
  // SPAWN ЇЖІ
  // ============================================================================

  /**
   * Створити їжу
   */
  spawnFood(foodIdCounter: number): Food | null {
    const position = this.getFoodSpawnPosition();
    if (!position) return null;

    const food = Food.create(foodIdCounter, position.x, position.y, position.z);

    // Відправити подію
    this.eventBus.emit({
      type: 'EntitySpawned',
      entityType: EntityType.FOOD,
      id: food.id as unknown as FoodId,
      position: { ...position },
    } as EntitySpawnedEvent);

    return food;
  }

  /**
   * Отримати позицію для спавну їжі
   */
  private getFoodSpawnPosition(): MutableVector3 | null {
    switch (this.config.foodStrategy) {
      case FoodSpawnStrategy.OASIS_PREFERRED:
        return this.getOasisPreferredPosition();

      case FoodSpawnStrategy.CLUSTERED:
        return this.getClusteredPosition();

      case FoodSpawnStrategy.UNIFORM:
        return this.getUniformPosition();

      case FoodSpawnStrategy.RANDOM:
      default:
        return this.getRandomValidPosition(5);
    }
  }

  /**
   * Позиція з перевагою оазису (30% ймовірність)
   */
  private getOasisPreferredPosition(): MutableVector3 | null {
    if (Math.random() < 0.3) {
      const oasis = this.zones.get('oasis_center');
      if (oasis) {
        const pos = this.getPositionInZone(oasis);
        if (pos && this.isValidPosition(pos, 5)) {
          return pos;
        }
      }
    }
    return this.getRandomValidPosition(5);
  }

  /**
   * Кластерна позиція (близько до існуючої їжі)
   */
  private getClusteredPosition(): MutableVector3 | null {
    // Знайти випадкову їжу в просторовій сітці
    const nearbyEntities = this.spatialGrid.getNearby(
      {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        z: Math.random() * WORLD_SIZE,
      },
      50
    );

    const foodEntities = Array.from(nearbyEntities).filter(e => e.type === EntityType.FOOD);
    if (foodEntities.length > 0) {
      const target = foodEntities[Math.floor(Math.random() * foodEntities.length)];
      // Spawn поблизу
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 15;

      const pos: MutableVector3 = {
        x: MathUtils.wrap(target.position.x + r * Math.sin(phi) * Math.cos(angle)),
        y: MathUtils.wrap(target.position.y + r * Math.sin(phi) * Math.sin(angle)),
        z: MathUtils.wrap(target.position.z + r * Math.cos(phi)),
      };

      if (this.isValidPosition(pos, 5)) {
        return pos;
      }
    }

    // Fallback
    return this.getRandomValidPosition(5);
  }

  // ============================================================================
  // ДОПОМІЖНІ МЕТОДИ
  // ============================================================================

  /**
   * Отримати випадкову валідну позицію
   */
  private getRandomValidPosition(minDistance: number): MutableVector3 | null {
    for (let attempt = 0; attempt < this.config.maxSpawnAttempts; attempt++) {
      const pos: MutableVector3 = {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        z: Math.random() * WORLD_SIZE,
      };

      if (this.isValidPosition(pos, minDistance)) {
        return pos;
      }
    }

    console.warn('SpawnService: Не вдалося знайти валідну позицію після максимуму спроб');
    return null;
  }

  /**
   * Отримати рівномірну позицію (grid-based)
   */
  private getUniformPosition(): MutableVector3 | null {
    const gridSize = 10;
    const cellSize = WORLD_SIZE / gridSize;

    // Випадкова комірка
    const cellX = Math.floor(Math.random() * gridSize);
    const cellY = Math.floor(Math.random() * gridSize);
    const cellZ = Math.floor(Math.random() * gridSize);

    // Випадкова позиція в комірці
    const pos: MutableVector3 = {
      x: cellX * cellSize + Math.random() * cellSize,
      y: cellY * cellSize + Math.random() * cellSize,
      z: cellZ * cellSize + Math.random() * cellSize,
    };

    if (this.isValidPosition(pos, 5)) {
      return pos;
    }

    // Fallback
    return this.getRandomValidPosition(5);
  }

  /**
   * Отримати позицію в зоні
   */
  private getPositionInZone(zone: EcologicalZone): MutableVector3 | null {
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * zone.radius;

      const pos: MutableVector3 = {
        x: zone.center.x + r * Math.sin(phi) * Math.cos(angle),
        y: zone.center.y + r * Math.sin(phi) * Math.sin(angle),
        z: zone.center.z + r * Math.cos(phi),
      };

      // Wrap around
      pos.x = MathUtils.wrap(pos.x);
      pos.y = MathUtils.wrap(pos.y);
      pos.z = MathUtils.wrap(pos.z);

      if (this.isValidPosition(pos, this.config.minOrganismDistance)) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Перевірити чи позиція валідна (не всередині перешкоди)
   */
  private isValidPosition(pos: Vector3, minDistance: number): boolean {
    // Перевірка перешкод
    for (const obstacle of this.obstacles.values()) {
      const dx = pos.x - obstacle.position.x;
      const dy = pos.y - obstacle.position.y;
      const dz = pos.z - obstacle.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const minDistSq = (obstacle.radius + minDistance) ** 2;

      if (distSq < minDistSq) {
        return false;
      }
    }

    return true;
  }

  /**
   * Скинути лічильники фабрики
   */
  resetFactory(): void {
    this.organismFactory.reset();
  }

  /**
   * Отримати фабрику організмів
   */
  getFactory(): OrganismFactory {
    return this.organismFactory;
  }
}
