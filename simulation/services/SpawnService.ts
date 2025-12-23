/**
 * Entropia 3D — Сервіс керування популяційними потоками (SpawnService).
 *
 * Централізований компонент, відповідальний за ініціалізацію та реплікацію об'єктів:
 * - Розрахунок оптимальних просторових координат для нових агентів.
 * - Врахування екологічної структури середовища (біоми та зони).
 * - Контроль просторових колізій з існуючими перешкодами.
 * - Реалізація гнучких стратегій розселення видів.
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
  // УПРАВЛІННЯ ОРГАНІЗМАМИ
  // ============================================================================

  /**
   * Виконує створення та реєстрацію нового біологічного агента.
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
      if (sanctuary && Math.random() < 0.4) {
        return this.getPositionInZone(sanctuary);
      }
      const oasis = this.zones.get('oasis_center');
      if (oasis && Math.random() < 0.4) {
        return this.getPositionInZone(oasis);
      }
    } else {
      // Пріоритетне розселення хижаків у зонах активного полювання
      const huntingGround = this.zones.get('hunting_ground');
      if (huntingGround && Math.random() < 0.4) {
        return this.getPositionInZone(huntingGround);
      }
      const desert = this.zones.get('desert_0');
      if (desert && Math.random() < 0.3) {
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
    if (!position) return null;

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
   * Створення нових ресурсів поблизу вже існуючих (кластерний ефект).
   */
  private getClusteredPosition(): MutableVector3 | null {
    // Пошук існуючих енергетичних центрів через просторову сітку
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
      // Розрахунок позиції у безпосередній близькості до знайденого об'єкта
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
      const pos: MutableVector3 = {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        z: Math.random() * WORLD_SIZE,
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
    const gridSize = 10;
    const cellSize = WORLD_SIZE / gridSize;

    const cellX = Math.floor(Math.random() * gridSize);
    const cellY = Math.floor(Math.random() * gridSize);
    const cellZ = Math.floor(Math.random() * gridSize);

    const pos: MutableVector3 = {
      x: cellX * cellSize + Math.random() * cellSize,
      y: cellY * cellSize + Math.random() * cellSize,
      z: cellZ * cellSize + Math.random() * cellSize,
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
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * zone.radius;

      const pos: MutableVector3 = {
        x: zone.center.x + r * Math.sin(phi) * Math.cos(angle),
        y: zone.center.y + r * Math.sin(phi) * Math.sin(angle),
        z: zone.center.z + r * Math.cos(phi),
      };

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
   * Валідація точки на предмет колізій із просторовими аномаліями.
   */
  private isValidPosition(pos: Vector3, minDistance: number): boolean {
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
