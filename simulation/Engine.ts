
/**
 * EVOSIM 3D — Симуляційний Движок
 *
 * Високопродуктивний движок еволюційної симуляції з:
 * - Просторовим хешуванням O(1) для пошуку сусідів
 * - Boids-алгоритмом для реалістичної поведінки
 * - Генетичним деревом для відстеження родоводу
 * - Екологічними зонами для різноманіття середовища
 * - Подієвою архітектурою для візуалізації
 */

import {
  EntityType,
  OrganismId,
  FoodId,
  SimulationEvent,
  SimulationStats,
  SimulationConfig,
  Vector3,
  MutableVector3,
  OrganismState,
  EcologicalZone,
  ZoneType,
  GeneticTreeNode,
  GenomeId,
  EntitySpawnedEvent,
  EntityDiedEvent,
  EntityReproducedEvent,
  createFoodId,
} from '../types';
import {
  WORLD_SIZE,
  INITIAL_PREY,
  INITIAL_PREDATOR,
  MAX_FOOD,
  FOOD_SPAWN_RATE,
  METABOLIC_CONSTANTS,
  PHYSICS,
  REPRODUCTION_ENERGY_THRESHOLD,
  MAX_TOTAL_ORGANISMS,
  INITIAL_VIS_CONFIG,
  MIN_REPRODUCTION_AGE,
  ZONE_DEFAULTS,
  GENETICS,
} from '../constants';
import { Organism, Food, Obstacle, OrganismFactory, isPrey, isPredator } from './Entity';
import { SpatialHashGrid } from './SpatialHashGrid';
import { MathUtils } from './MathUtils';

// ============================================================================
// ТИПИ
// ============================================================================

type EventListener = (event: SimulationEvent) => void;

interface NewbornData {
  parent: Organism;
}

// ============================================================================
// ГОЛОВНИЙ КЛАС ДВИГУНА
// ============================================================================

export class SimulationEngine {
  // Колекції сутностей
  public readonly organisms: Map<string, Organism> = new Map();
  public readonly food: Map<string, Food> = new Map();
  public readonly obstacles: Map<string, Obstacle> = new Map();
  public readonly zones: Map<string, EcologicalZone> = new Map();

  // Генетичне дерево
  public readonly geneticTree: Map<GenomeId, GeneticTreeNode> = new Map();
  public readonly geneticRoots: GenomeId[] = [];

  // Просторове хешування
  private readonly grid: SpatialHashGrid = new SpatialHashGrid();

  // Фабрика організмів
  private readonly organismFactory: OrganismFactory = new OrganismFactory();

  // Лічильники
  private foodIdCounter: number = 0;
  private obstacleIdCounter: number = 0;
  private tick: number = 0;

  // Статистика
  private stats = {
    totalDeaths: 0,
    totalBirths: 0,
    maxAge: 0,
    maxGeneration: 1,
    preyDeaths: 0,
    predatorDeaths: 0,
  };

  // Слухачі подій
  private listeners: EventListener[] = [];

  // Конфігурація
  public config: SimulationConfig;

  constructor() {
    this.config = this.createDefaultConfig();
    this.init();
  }

  // ============================================================================
  // ІНІЦІАЛІЗАЦІЯ
  // ============================================================================

  private createDefaultConfig(): SimulationConfig {
    return {
      foodSpawnRate: FOOD_SPAWN_RATE,
      maxFood: MAX_FOOD,
      mutationFactor: GENETICS.mutationFactor,
      reproductionThreshold: REPRODUCTION_ENERGY_THRESHOLD,
      drag: PHYSICS.drag,
      separationWeight: PHYSICS.separationWeight,
      alignmentWeight: PHYSICS.alignmentWeight,
      cohesionWeight: PHYSICS.cohesionWeight,
      seekWeight: PHYSICS.seekWeight,
      avoidWeight: PHYSICS.avoidWeight,
      ...INITIAL_VIS_CONFIG,
    };
  }

  private init(): void {
    this.createZones();
    this.createObstacles();
    this.createInitialPopulation();
  }

  /** Створити екологічні зони */
  private createZones(): void {
    // Оазис у центрі
    this.zones.set('oasis_center', {
      id: 'oasis_center',
      type: ZoneType.OASIS,
      center: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, z: WORLD_SIZE / 2 },
      radius: WORLD_SIZE * 0.15,
      foodMultiplier: ZONE_DEFAULTS.OASIS.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.OASIS.dangerMultiplier,
    });

    // Пустельні кути
    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: WORLD_SIZE, y: WORLD_SIZE, z: WORLD_SIZE },
    ];
    corners.forEach((pos, i) => {
      this.zones.set(`desert_${i}`, {
        id: `desert_${i}`,
        type: ZoneType.DESERT,
        center: pos,
        radius: WORLD_SIZE * 0.2,
        foodMultiplier: ZONE_DEFAULTS.DESERT.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.DESERT.dangerMultiplier,
      });
    });

    // Мисливські угіддя
    this.zones.set('hunting_ground', {
      id: 'hunting_ground',
      type: ZoneType.HUNTING_GROUND,
      center: { x: WORLD_SIZE * 0.75, y: WORLD_SIZE / 2, z: WORLD_SIZE * 0.25 },
      radius: WORLD_SIZE * 0.12,
      foodMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.dangerMultiplier,
    });

    // Притулок
    this.zones.set('sanctuary', {
      id: 'sanctuary',
      type: ZoneType.SANCTUARY,
      center: { x: WORLD_SIZE * 0.25, y: WORLD_SIZE / 2, z: WORLD_SIZE * 0.75 },
      radius: WORLD_SIZE * 0.1,
      foodMultiplier: ZONE_DEFAULTS.SANCTUARY.foodMultiplier,
      dangerMultiplier: ZONE_DEFAULTS.SANCTUARY.dangerMultiplier,
    });
  }

  /** Створити початкові перешкоди */
  private createObstacles(): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const radius = 12 + Math.random() * 25;
      const obstacle = Obstacle.create(
        ++this.obstacleIdCounter,
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        radius
      );
      this.obstacles.set(obstacle.id, obstacle);
    }
  }

  /** Створити початкову популяцію */
  private createInitialPopulation(): void {
    for (let i = 0; i < INITIAL_PREY; i++) {
      this.spawnOrganism(EntityType.PREY);
    }
    for (let i = 0; i < INITIAL_PREDATOR; i++) {
      this.spawnOrganism(EntityType.PREDATOR);
    }
  }

  // ============================================================================
  // ПУБЛІЧНІ МЕТОДИ
  // ============================================================================

  /** Скинути симуляцію */
  public reset(): void {
    this.organisms.clear();
    this.food.clear();
    this.obstacles.clear();
    this.zones.clear();
    this.geneticTree.clear();
    this.geneticRoots.length = 0;
    this.grid.clear();

    this.foodIdCounter = 0;
    this.obstacleIdCounter = 0;
    this.tick = 0;
    this.stats = {
      totalDeaths: 0,
      totalBirths: 0,
      maxAge: 0,
      maxGeneration: 1,
      preyDeaths: 0,
      predatorDeaths: 0,
    };

    this.organismFactory.reset();
    this.init();
  }

  /** Підписатися на події */
  public addEventListener(callback: EventListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /** Головний цикл оновлення */
  public update(): void {
    this.tick++;
    this.spawnFood();
    this.rebuildGrid();

    const deadIds: string[] = [];
    const newborns: NewbornData[] = [];

    // Оновлення всіх організмів
    this.organisms.forEach(org => {
      if (org.isDead) return;

      this.applyBehaviors(org);
      this.integrate(org);
      this.handleMetabolism(org);
      this.handleCollisions(org, deadIds);
      this.checkReproduction(org, newborns);

      // Оновлення статистики
      if (org.age > this.stats.maxAge) {
        this.stats.maxAge = org.age;
      }
      if (org.genome.generation > this.stats.maxGeneration) {
        this.stats.maxGeneration = org.genome.generation;
      }
    });

    // Обробка народжень
    this.processNewborns(newborns);

    // Обробка смертей
    this.processDeaths(deadIds);

    // Відправка оновлення стану
    this.emit({
      type: 'TickUpdated',
      tick: this.tick,
      stats: this.calculateStats(),
      deltaTime: 1 / 60,
    });
  }

  // ============================================================================
  // СПАВН СУТНОСТЕЙ
  // ============================================================================

  /** Спавн організму */
  private spawnOrganism(type: EntityType, pos?: Vector3, parent?: Organism): Organism | null {
    if (this.organisms.size >= MAX_TOTAL_ORGANISMS) return null;

    let organism: Organism;
    const position = pos || this.getRandomPosition();

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

    this.organisms.set(organism.id, organism);

    // Додати до генетичного дерева
    this.addToGeneticTree(organism, parent);

    // Відправити подію
    this.emit({
      type: 'EntitySpawned',
      entityType: organism.type,
      id: organism.id as OrganismId,
      position: { ...organism.position },
      parentId: parent?.id as OrganismId | undefined,
    } as EntitySpawnedEvent);

    return organism;
  }

  /** Спавн їжі */
  private spawnFood(): void {
    if (this.food.size >= this.config.maxFood) return;

    // Базовий шанс спавну
    let spawnChance = this.config.foodSpawnRate;

    // Збільшити шанс у оазисах
    if (Math.random() < spawnChance) {
      const position = this.getFoodSpawnPosition();
      const food = Food.create(
        ++this.foodIdCounter,
        position.x,
        position.y,
        position.z
      );
      this.food.set(food.id, food);

      this.emit({
        type: 'EntitySpawned',
        entityType: EntityType.FOOD,
        id: food.id as unknown as FoodId,
        position: { ...position },
      } as EntitySpawnedEvent);
    }
  }

  /** Отримати позицію для спавну їжі з урахуванням зон */
  private getFoodSpawnPosition(): MutableVector3 {
    // 30% шанс спавну в оазисі
    if (Math.random() < 0.3) {
      const oasis = this.zones.get('oasis_center');
      if (oasis) {
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * oasis.radius;
        return {
          x: oasis.center.x + r * Math.sin(phi) * Math.cos(angle),
          y: oasis.center.y + r * Math.sin(phi) * Math.sin(angle),
          z: oasis.center.z + r * Math.cos(phi),
        };
      }
    }
    return this.getRandomPosition();
  }

  /** Випадкова позиція у світі */
  private getRandomPosition(): MutableVector3 {
    return {
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      z: Math.random() * WORLD_SIZE,
    };
  }

  // ============================================================================
  // ПОВЕДІНКА (BOIDS + STEERING)
  // ============================================================================

  /** Застосувати поведінкові сили */
  private applyBehaviors(org: Organism): void {
    const neighbors = this.grid.getNearby(org.position, org.genome.senseRadius);

    // Накопичувачі сил
    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let seekX = 0, seekY = 0, seekZ = 0;
    let fleeX = 0, fleeY = 0, fleeZ = 0;
    let obsX = 0, obsY = 0, obsZ = 0;
    let alignX = 0, alignY = 0, alignZ = 0, alignCount = 0;

    let closestTargetDist = Infinity;
    let targetPos: Vector3 | null = null;

    // Визначення поточного стану
    let newState = OrganismState.IDLE;

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n.id === org.id) continue;

      const dx = n.position.x - org.position.x;
      const dy = n.position.y - org.position.y;
      const dz = n.position.z - org.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      if (dist < 0.001) continue;

      // Уникання перешкод
      if (n.type === EntityType.OBSTACLE) {
        const obs = this.obstacles.get(n.id);
        if (obs && dist < obs.radius + org.radius + 25) {
          const force = 1 / (dist * dist);
          obsX -= dx / dist * force;
          obsY -= dy / dist * force;
          obsZ -= dz / dist * force;
        }
        continue;
      }

      // Сепарація (уникання зіткнень)
      const separationRadius = org.radius + 18;
      if (dist < separationRadius) {
        const force = (separationRadius - dist) / separationRadius;
        sepX -= dx / dist * force;
        sepY -= dy / dist * force;
        sepZ -= dz / dist * force;
        sepCount++;
      }

      // Поведінка травоїдних
      if (org.isPrey) {
        if (n.type === EntityType.FOOD && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = OrganismState.SEEKING;
        } else if (n.type === EntityType.PREDATOR) {
          // Втеча від хижака
          const fleeForce = org.genome.senseRadius / (dist * dist);
          fleeX -= dx / dist * fleeForce;
          fleeY -= dy / dist * fleeForce;
          fleeZ -= dz / dist * fleeForce;
          newState = OrganismState.FLEEING;
        } else if (n.type === EntityType.PREY) {
          // Стадна поведінка
          const other = this.organisms.get(n.id);
          if (other && dist < org.genome.senseRadius * 0.5) {
            alignX += other.velocity.x;
            alignY += other.velocity.y;
            alignZ += other.velocity.z;
            alignCount++;
          }
        }
      }

      // Поведінка хижаків
      if (org.isPredator) {
        if (n.type === EntityType.PREY && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = OrganismState.HUNTING;
        }
      }
    }

    // Застосування зон
    const zoneModifier = this.getZoneModifier(org.position, org.type);

    // Нормалізація та застосування сил
    if (sepCount > 0) {
      const mag = Math.sqrt(sepX * sepX + sepY * sepY + sepZ * sepZ);
      if (mag > 0) {
        org.acceleration.x += (sepX / mag) * this.config.separationWeight;
        org.acceleration.y += (sepY / mag) * this.config.separationWeight;
        org.acceleration.z += (sepZ / mag) * this.config.separationWeight;
      }
    }

    if (targetPos) {
      seekX = targetPos.x - org.position.x;
      seekY = targetPos.y - org.position.y;
      seekZ = targetPos.z - org.position.z;
      const mag = Math.sqrt(seekX * seekX + seekY * seekY + seekZ * seekZ);
      if (mag > 0) {
        const weight = this.config.seekWeight * zoneModifier.seekMultiplier;
        org.acceleration.x += (seekX / mag) * weight;
        org.acceleration.y += (seekY / mag) * weight;
        org.acceleration.z += (seekZ / mag) * weight;
      }
    }

    // Втеча
    const fleeMag = Math.sqrt(fleeX * fleeX + fleeY * fleeY + fleeZ * fleeZ);
    if (fleeMag > 0) {
      org.acceleration.x += (fleeX / fleeMag) * this.config.avoidWeight;
      org.acceleration.y += (fleeY / fleeMag) * this.config.avoidWeight;
      org.acceleration.z += (fleeZ / fleeMag) * this.config.avoidWeight;
    }

    // Перешкоди
    const obsMag = Math.sqrt(obsX * obsX + obsY * obsY + obsZ * obsZ);
    if (obsMag > 0) {
      org.acceleration.x += (obsX / obsMag) * 12;
      org.acceleration.y += (obsY / obsMag) * 12;
      org.acceleration.z += (obsZ / obsMag) * 12;
    }

    // Вирівнювання (стадо)
    if (alignCount > 0 && org.isPrey) {
      alignX /= alignCount;
      alignY /= alignCount;
      alignZ /= alignCount;
      const mag = Math.sqrt(alignX * alignX + alignY * alignY + alignZ * alignZ);
      if (mag > 0) {
        const genome = org.genome as { flockingStrength: number };
        const flockWeight = this.config.alignmentWeight * genome.flockingStrength;
        org.acceleration.x += (alignX / mag - org.velocity.x) * flockWeight;
        org.acceleration.y += (alignY / mag - org.velocity.y) * flockWeight;
        org.acceleration.z += (alignZ / mag - org.velocity.z) * flockWeight;
      }
    }

    // Оновити стан
    org.updateState(newState);
  }

  /** Отримати модифікатори зони */
  private getZoneModifier(pos: Vector3, type: EntityType): { seekMultiplier: number; dangerMultiplier: number } {
    let seekMultiplier = 1;
    let dangerMultiplier = 1;

    this.zones.forEach(zone => {
      const dx = pos.x - zone.center.x;
      const dy = pos.y - zone.center.y;
      const dz = pos.z - zone.center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < zone.radius * zone.radius) {
        seekMultiplier *= zone.foodMultiplier;
        dangerMultiplier *= zone.dangerMultiplier;
      }
    });

    // Хижаки отримують бонус у мисливських угіддях
    if (type === EntityType.PREDATOR) {
      seekMultiplier *= dangerMultiplier;
    }

    return { seekMultiplier, dangerMultiplier };
  }

  // ============================================================================
  // ФІЗИКА
  // ============================================================================

  /** Інтегрування руху */
  private integrate(org: Organism): void {
    // Обмеження прискорення
    const accMag = Math.sqrt(
      org.acceleration.x * org.acceleration.x +
      org.acceleration.y * org.acceleration.y +
      org.acceleration.z * org.acceleration.z
    );
    if (accMag > PHYSICS.maxSteeringForce) {
      const scale = PHYSICS.maxSteeringForce / accMag;
      org.acceleration.x *= scale;
      org.acceleration.y *= scale;
      org.acceleration.z *= scale;
    }

    // Оновлення швидкості
    org.velocity.x += org.acceleration.x;
    org.velocity.y += org.acceleration.y;
    org.velocity.z += org.acceleration.z;

    // Обмеження швидкості
    const speed = Math.sqrt(
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z
    );
    if (speed > org.genome.maxSpeed) {
      const scale = org.genome.maxSpeed / speed;
      org.velocity.x *= scale;
      org.velocity.y *= scale;
      org.velocity.z *= scale;
    }

    // Оновлення позиції з тороїдальним простором
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z);

    // Скидання прискорення
    org.acceleration.x = 0;
    org.acceleration.y = 0;
    org.acceleration.z = 0;

    // Застосування тертя
    org.velocity.x *= this.config.drag;
    org.velocity.y *= this.config.drag;
    org.velocity.z *= this.config.drag;
  }

  // ============================================================================
  // МЕТАБОЛІЗМ
  // ============================================================================

  /** Обробка метаболізму */
  private handleMetabolism(org: Organism): void {
    const vSq = org.velocity.x * org.velocity.x +
                org.velocity.y * org.velocity.y +
                org.velocity.z * org.velocity.z;

    const loss = (
      METABOLIC_CONSTANTS.exist * org.radius * 0.5 +
      METABOLIC_CONSTANTS.move * vSq +
      METABOLIC_CONSTANTS.sense * org.genome.senseRadius * 0.01 +
      METABOLIC_CONSTANTS.size * org.genome.size
    ) * org.genome.metabolism;

    org.consumeEnergy(loss);
    org.age++;
    org.lastActiveAt = this.tick;
  }

  // ============================================================================
  // ЗІТКНЕННЯ
  // ============================================================================

  /** Обробка зіткнень */
  private handleCollisions(org: Organism, deadIds: string[]): void {
    if (org.isDead) return;

    const neighbors = this.grid.getNearby(org.position, org.radius + 20);

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n.id === org.id) continue;

      const dx = n.position.x - org.position.x;
      const dy = n.position.y - org.position.y;
      const dz = n.position.z - org.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Зіткнення з перешкодами
      if (n.type === EntityType.OBSTACLE) {
        const obs = this.obstacles.get(n.id);
        if (obs) {
          const minDist = org.radius + obs.radius;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              // Відбиття
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;
              const dot = org.velocity.x * nx + org.velocity.y * ny + org.velocity.z * nz;
              org.velocity.x -= 2 * dot * nx;
              org.velocity.y -= 2 * dot * ny;
              org.velocity.z -= 2 * dot * nz;

              // Виштовхування
              const overlap = minDist - dist;
              org.position.x -= nx * overlap * 1.1;
              org.position.y -= ny * overlap * 1.1;
              org.position.z -= nz * overlap * 1.1;
            }
          }
        }
        continue;
      }

      // Зіткнення з їжею (тільки травоїдні)
      if (n.type === EntityType.FOOD && org.isPrey) {
        const food = this.food.get(n.id);
        if (food && !food.consumed) {
          const minDist = org.radius + food.radius;
          if (distSq < minDist * minDist) {
            org.addEnergy(food.energyValue);
            food.consumed = true;
            this.food.delete(n.id);

            this.emit({
              type: 'EntityDied',
              entityType: EntityType.FOOD,
              id: n.id as unknown as FoodId,
              position: { ...food.position },
              causeOfDeath: 'predation',
            } as EntityDiedEvent);
          }
        }
        continue;
      }

      // Зіткнення хижака з травоїдним
      if (n.type === EntityType.PREY && org.isPredator) {
        const prey = this.organisms.get(n.id);
        if (prey && !prey.isDead) {
          const minDist = org.radius + prey.radius;
          if (distSq < minDist * minDist) {
            // Успішне полювання
            const energyGain = Math.max(25, prey.energy * 0.6);
            org.addEnergy(energyGain);
            org.huntSuccessCount++;

            prey.die('predation');
            deadIds.push(prey.id);
          }
        }
      }
    }
  }

  // ============================================================================
  // РОЗМНОЖЕННЯ
  // ============================================================================

  /** Перевірка можливості розмноження */
  private checkReproduction(org: Organism, newborns: NewbornData[]): void {
    if (org.isDead) return;
    if (org.energy < this.config.reproductionThreshold) return;
    if (org.age < MIN_REPRODUCTION_AGE) return;

    // Витратити енергію на розмноження
    org.energy *= 0.45;
    org.updateState(OrganismState.REPRODUCING);

    newborns.push({ parent: org });
  }

  /** Обробка народжень */
  private processNewborns(newborns: NewbornData[]): void {
    for (const data of newborns) {
      const child = this.spawnOrganism(data.parent.type, undefined, data.parent);
      if (child) {
        this.stats.totalBirths++;

        this.emit({
          type: 'EntityReproduced',
          parentId: data.parent.id as OrganismId,
          childId: child.id as OrganismId,
          position: { ...child.position },
          generation: child.genome.generation,
        } as EntityReproducedEvent);
      }
    }
  }

  /** Обробка смертей */
  private processDeaths(deadIds: string[]): void {
    for (const id of deadIds) {
      const org = this.organisms.get(id);
      if (org) {
        this.stats.totalDeaths++;
        if (org.isPrey) this.stats.preyDeaths++;
        else this.stats.predatorDeaths++;

        // Оновити генетичне дерево
        const node = this.geneticTree.get(org.genome.id);
        if (node) {
          (node as any).died = this.tick;
        }

        this.emit({
          type: 'EntityDied',
          entityType: org.type,
          id: org.id as OrganismId,
          position: { ...org.position },
          causeOfDeath: org.causeOfDeath || 'starvation',
        } as EntityDiedEvent);

        this.organisms.delete(id);
      }
    }
  }

  // ============================================================================
  // ГЕНЕТИЧНЕ ДЕРЕВО
  // ============================================================================

  /** Додати організм до генетичного дерева */
  private addToGeneticTree(org: Organism, parent?: Organism): void {
    const node: GeneticTreeNode = {
      id: org.genome.id,
      parentId: parent?.genome.id || null,
      children: [],
      generation: org.genome.generation,
      born: this.tick,
      died: null,
      type: org.type,
      traits: {
        speed: org.genome.maxSpeed,
        sense: org.genome.senseRadius,
        size: org.genome.size,
      },
    };

    this.geneticTree.set(org.genome.id, node);

    if (parent) {
      const parentNode = this.geneticTree.get(parent.genome.id);
      if (parentNode) {
        (parentNode.children as GenomeId[]).push(org.genome.id);
      }
    } else {
      this.geneticRoots.push(org.genome.id);
    }
  }

  // ============================================================================
  // ДОПОМІЖНІ МЕТОДИ
  // ============================================================================

  /** Перебудувати просторову сітку */
  private rebuildGrid(): void {
    this.grid.clear();

    this.organisms.forEach(o => {
      if (!o.isDead) {
        this.grid.insert({
          id: o.id,
          position: o.position,
          type: o.type,
          radius: o.radius,
        });
      }
    });

    this.food.forEach(f => {
      if (!f.consumed) {
        this.grid.insert({
          id: f.id,
          position: f.position,
          type: f.type,
          radius: f.radius,
        });
      }
    });

    this.obstacles.forEach(ob => {
      this.grid.insert({
        id: ob.id,
        position: ob.position,
        type: ob.type,
        radius: ob.radius,
      });
    });
  }

  /** Відправити подію всім слухачам */
  private emit(event: SimulationEvent): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i](event);
    }
  }

  /** Розрахувати статистику */
  private calculateStats(): SimulationStats {
    let prey = 0;
    let pred = 0;
    let preyEnergySum = 0;
    let predEnergySum = 0;

    this.organisms.forEach(o => {
      if (o.isDead) return;
      if (o.isPrey) {
        prey++;
        preyEnergySum += o.energy;
      } else {
        pred++;
        predEnergySum += o.energy;
      }
    });

    const totalEnergy = preyEnergySum + predEnergySum;
    const totalCount = prey + pred;

    // Розрахунок ризику вимирання
    const minViablePopulation = 5;
    const preyRisk = prey < minViablePopulation ? 1 - prey / minViablePopulation : 0;
    const predRisk = pred < minViablePopulation ? 1 - pred / minViablePopulation : 0;
    const extinctionRisk = Math.max(preyRisk, predRisk);

    return {
      preyCount: prey,
      predatorCount: pred,
      foodCount: this.food.size,
      avgEnergy: totalCount > 0 ? totalEnergy / totalCount : 0,
      avgPreyEnergy: prey > 0 ? preyEnergySum / prey : 0,
      avgPredatorEnergy: pred > 0 ? predEnergySum / pred : 0,
      generation: this.stats.maxGeneration,
      maxGeneration: this.stats.maxGeneration,
      maxAge: this.stats.maxAge,
      totalDeaths: this.stats.totalDeaths,
      totalBirths: this.stats.totalBirths,
      extinctionRisk,
    };
  }

  /** Отримати поточний тік */
  public getTick(): number {
    return this.tick;
  }

  /** Отримати генетичне дерево для візуалізації */
  public getGeneticTree() {
    return {
      nodes: this.geneticTree,
      roots: this.geneticRoots,
      maxGeneration: this.stats.maxGeneration,
    };
  }
}
