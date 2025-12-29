/**
 * Entropia 3D — Сервіс керування популяційними потоками (SpawnService).
 *
 * Централізований компонент, відповідальний за ініціалізацію та реплікацію об'єктів:
 * - Розрахунок оптимальних просторових координат для нових агентів.
 * - Врахування екологічної структури середовища (біоми та зони).
 * - Контроль просторових колізій з існуючими перешкодами.
 * - Реалізація гнучких стратегій розселення видів.
 */

import { WORLD_SIZE } from '@/config'; // We might still need this as default if optional, or remove if fully injected.
import type { EventBus } from '@/core/EventBus.ts';
import { Random } from '@/core/utils/Random';
import type {
  EcologicalZone,
  EntitySpawnedEvent,
  FoodId,
  MutableVector3,
  OrganismId,
  Vector3,
  WorldConfig,
  GridEntity
} from '@/types.ts';
import {
  EntityType,
  // ZoneType // unused
} from '@/types.ts';

import type { Obstacle, Organism } from '../Entity';
import { Food, OrganismFactory } from '../Entity';
import { MathUtils } from '../MathUtils';
import type { GridManager } from '../managers/GridManager';

// ============================================================================
// ПЕРЕЛІКИ ТА ОБ'ЄКТИ КОНФІГУРАЦІЇ
// ============================================================================

/**
 * Стратегії просторового розподілу енергетичних субстратів (їжі).
 */
export enum FoodSpawnStrategy {
  /** Стохастичне рівномірне розміщення по всьому об'єму. */
  RANDOM = 'random',
  /** Пріоритетне розміщення в оазисах (висока ймовірність концентрації). */
  OASIS_PREFERRED = 'oasis_preferred',
  /** Формування локальних кластерів (агреговане розселення). */
  CLUSTERED = 'clustered',
  /** Регулярне (сіткове) розміщення. */
  UNIFORM = 'uniform',
}

/**
 * Стратегії територіальної експансії біологічних агентів.
 */
export enum OrganismSpawnStrategy {
  /** Випадкова ініціалізація позиції. */
  RANDOM = 'random',
  /** Екологічно детерміноване розселення (жертви — у безпечних зонах, хижаки — у мисливських угіддях). */
  ECOLOGICAL = 'ecological',
  /** Рівномірне заповнення простору. */
  UNIFORM = 'uniform',
}

/**
 * Параметри конфігурації сервісу ініціалізації.
 */
export interface SpawnConfig {
  /** Обрана модель розподілу їжі. */
  foodStrategy: FoodSpawnStrategy;
  /** Обрана модель розселення організмів. */
  organismStrategy: OrganismSpawnStrategy;
  /** Мінімально допустима дистанція до структурних аномалій. */
  minObstacleDistance: number;
  /** Поріг просторового розмежування між агентами при ініціалізації. */
  minOrganismDistance: number;
  /** Гранична кількість ітерацій пошуку валідної локації. */
  maxSpawnAttempts: number;
}

/**
 * Значення конфігурації за замовчуванням (базова налаштування середовища).
 */
const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  foodStrategy: FoodSpawnStrategy.OASIS_PREFERRED,
  organismStrategy: OrganismSpawnStrategy.ECOLOGICAL,
  minObstacleDistance: 15,
  minOrganismDistance: 10,
  maxSpawnAttempts: 50,
};

// ============================================================================
// РЕАЛІЗАЦІЯ СЕРВІСУ (SPAWN SERVICE)
// ============================================================================

/**
 * Клас, що інкапсулює логіку наповнення світу об'єктами.
 */
export class SpawnService {
  private readonly config: SpawnConfig;
  private readonly organismFactory: OrganismFactory;

  private rand(): number {
    return this.rng ? this.rng.next() : Math.random();
  }

  constructor(
    private readonly eventBus: EventBus,
    private readonly gridManager: GridManager,
    private readonly zones: Map<string, EcologicalZone>,
    private readonly obstacles: Map<string, Obstacle>,
    private readonly rng?: Random,
    config?: Partial<SpawnConfig>,
    private readonly worldConfig?: WorldConfig // Added optional for now to avoid breaking tests if any
  ) {
    this.config = { ...DEFAULT_SPAWN_CONFIG, ...config };
    this.organismFactory = new OrganismFactory(this.rng ?? Random.fromMath());
  }

  // ============================================================================
  // УПРАВЛІННЯ ОРГАНІЗМАМИ
  // ============================================================================

  // Helper getter for WorldSize
  private get worldSize(): number {
    return this.worldConfig?.WORLD_SIZE ?? WORLD_SIZE;
  }

  /**
   * Виконує створення та реєстрацію нового біологічного агента.
   */
  spawnOrganism(
    type: EntityType,
    parent?: Organism
  ): Organism | null {
    const position = this.getOrganismSpawnPosition(type);
    if (!position) { return null; }

    let organism: Organism;

    if (parent) {
      // Default to INITIAL_ENERGY if not specified (SpawnService logic usually implies new full organisms or specific logic)
      // Actually, createOffspring expects specific energy. Using INITIAL_ENERGY constant.
      organism = this.organismFactory.createOffspring(parent, 100); // 100 is placeholder, should ideally come from config or parent
      organism.position.x = position.x;
      organism.position.y = position.y;
      organism.position.z = position.z;
    } else if (type === EntityType.PREY) {
      organism = this.organismFactory.createPrey(position.x, position.y, position.z);
    } else {
      organism = this.organismFactory.createPredator(position.x, position.y, position.z);
    }

    // Трансляція події про успішне створення сутності
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
   * Розрахунок оптимальної локації для спавну згідно з обраною стратегією.
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
   * Визначення позиції на основі екологічних уподобань виду.
   */
  private getEcologicalPosition(type: EntityType): MutableVector3 | null {
    if (type === EntityType.PREY) {
      // Пріоритетне розселення травоїдних у заповідних зонах та біля джерел ресурсів
      const sanctuary = this.zones.get('sanctuary');
      if (sanctuary && this.rand() < 0.4) {
        return this.getPositionInZone(sanctuary);
      }
      const oasis = this.zones.get('oasis_center');
      if (oasis && this.rand() < 0.4) {
        return this.getPositionInZone(oasis);
      }
    } else {
      // Пріоритетне розселення хижаків у зонах активного полювання
      const huntingGround = this.zones.get('hunting_ground');
      if (huntingGround && this.rand() < 0.4) {
        return this.getPositionInZone(huntingGround);
      }
      const desert = this.zones.get('desert_0');
      if (desert && this.rand() < 0.3) {
        return this.getPositionInZone(desert);
      }
    }

    // Резервний варіант: випадкова валідна позиція
    return this.getRandomValidPosition(this.config.minOrganismDistance);
  }

  // ============================================================================
  // УПРАВЛІННЯ РЕСУРСНИМИ ОДИНИЦЯМИ (ЇЖЕЮ)
  // ============================================================================

  /**
   * Ініціалізація створення об'єкта їжі.
   */
  spawnFood(foodIdCounter: number): Food | null {
    const position = this.getFoodSpawnPosition();
    if (!position) { return null; }

    const food = Food.create(foodIdCounter, position.x, position.y, position.z);

    // Нотифікація системи про появу нового ресурсу
    this.eventBus.emit({
      type: 'EntitySpawned',
      entityType: EntityType.FOOD,
      id: food.id as unknown as FoodId,
      position: { ...position },
    } as EntitySpawnedEvent);

    return food;
  }

  /**
   * Визначення локації для розміщення їжі згідно зі стратегією.
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
   * Формування ресурсів з підвищеною щільністю в р-ні оазисів.
   */
  private getOasisPreferredPosition(): MutableVector3 | null {
    if (this.rand() < 0.3) {
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

  /** Кешований буфер сусідів для уникнення алокацій. */
  private readonly nearbyBuffer: GridEntity[] = [];

  /**
   * Створення нових ресурсів поблизу вже існуючих (кластерний ефект).
   */
  private getClusteredPosition(): MutableVector3 | null {
    // Пошук існуючих енергетичних центрів через просторову сітку
    const ws = this.worldSize;
    this.gridManager.getNearby(
      {
        x: this.rand() * ws,
        y: this.rand() * ws,
        z: this.rand() * ws,
      },
      50,
      this.nearbyBuffer
    );

    const foodEntities = this.nearbyBuffer.filter(e => e.type === EntityType.FOOD);
    if (foodEntities.length > 0) {
      const target = foodEntities[Math.floor(this.rand() * foodEntities.length)];
      if (!target) { return this.getRandomValidPosition(5); }
      // Розрахунок позиції у безпосередній близькості до знайденого об'єкта
      const angle = this.rand() * Math.PI * 2;
      const phi = Math.acos(2 * this.rand() - 1);
      const r = 5 + this.rand() * 15;

      const pos: MutableVector3 = {
        x: MathUtils.wrap(target.position.x + r * Math.sin(phi) * Math.cos(angle), ws),
        y: MathUtils.wrap(target.position.y + r * Math.sin(phi) * Math.sin(angle), ws),
        z: MathUtils.wrap(target.position.z + r * Math.cos(phi), ws),
      };

      if (this.isValidPosition(pos, 5)) {
        return pos;
      }
    }

    return this.getRandomValidPosition(5);
  }

  // ============================================================================
  // ТЕХНІЧНІ ТА ВАЛІДАЦІЙНІ МЕТОДИ
  // ============================================================================

  /**
   * Генерація випадкових координат із багаторазовими перевірками на валідність.
   */
  private getRandomValidPosition(minDistance: number): MutableVector3 | null {
    for (let attempt = 0; attempt < this.config.maxSpawnAttempts; attempt++) {
      const ws = this.worldSize;
      const pos: MutableVector3 = {
        x: this.rand() * ws,
        y: this.rand() * ws,
        z: this.rand() * ws,
      };

      if (this.isValidPosition(pos, minDistance)) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Формування координат на основі регулярної дискретної сітки.
   */
  private getUniformPosition(): MutableVector3 | null {
    const ws = this.worldSize;
    const gridSize = 10;
    const cellSize = ws / gridSize;

    const cellX = Math.floor(this.rand() * gridSize);
    const cellY = Math.floor(this.rand() * gridSize);
    const cellZ = Math.floor(this.rand() * gridSize);

    const pos: MutableVector3 = {
      x: cellX * cellSize + this.rand() * cellSize,
      y: cellY * cellSize + this.rand() * cellSize,
      z: cellZ * cellSize + this.rand() * cellSize,
    };

    if (this.isValidPosition(pos, 5)) {
      return pos;
    }

    return this.getRandomValidPosition(5);
  }

  /**
   * Генерація точки всередині заданого сферичного об'єму (біома).
   */
  private getPositionInZone(zone: EcologicalZone): MutableVector3 | null {
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = this.rand() * Math.PI * 2;
      const phi = Math.acos(2 * this.rand() - 1);
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
   * Валідація точки на предмет колізій із просторовими аномаліями.
   */
  private isValidPosition(pos: Vector3, minDistance: number): boolean {
    for (const obstacle of this.obstacles.values()) {
      const distSq = MathUtils.toroidalDistanceSq(pos, obstacle.position, this.worldSize);
      const minDistSq = (obstacle.radius + minDistance) ** 2;

      if (distSq < minDistSq) {
        return false;
      }
    }

    return true;
  }

  /**
   * Повне скидання внутрішнього стану фабрик організмів.
   */
  resetFactory(): void {
    this.organismFactory.reset();
  }

  /**
   * Доступ до екземпляра фабрики для зовнішніх маніпуляцій.
   */
  getFactory(): OrganismFactory {
    return this.organismFactory;
  }
}
