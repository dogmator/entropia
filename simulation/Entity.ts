
/**
 * Entropia 3D — Сутності симуляції
 *
 * Академічно коректна ієрархія класів для:
 * - Організмів (травоїдні та хижаки)
 * - Їжі (енергокристали)
 * - Перешкод (аномалії)
 *
 * Використовує Discriminated Unions для типобезпечного патерн-матчингу
 */

import {
  EntityType,
  EntityId,
  OrganismId,
  FoodId,
  ObstacleId,
  GenomeId,
  MutableVector3,
  Vector3,
  Genome,
  PreyGenome,
  PredatorGenome,
  OrganismState,
  PredatorSubtype,
  createOrganismId,
  createFoodId,
  createObstacleId,
  createGenomeId,
  vec3Zero,
  vec3Clone,
  isPreyGenome,
} from '../types';
import {
  INITIAL_ENERGY,
  MAX_ENERGY,
  FOOD_ENERGY_VALUE,
  GENETICS,
  COLORS,
  PREDATOR_SUBTYPES,
} from '../constants';

// ============================================================================
// АБСТРАКТНА БАЗОВА СУТНІСТЬ
// ============================================================================

/**
 * Базовий клас для всіх сутностей у світі симуляції
 */
export abstract class Entity {
  public abstract readonly type: EntityType;

  constructor(
    public readonly id: EntityId,
    public position: MutableVector3,
    public radius: number
  ) { }

  /** Квадрат відстані до іншої точки (швидше ніж sqrt) */
  distanceSquaredTo(other: Vector3): number {
    const dx = this.position.x - other.x;
    const dy = this.position.y - other.y;
    const dz = this.position.z - other.z;
    return dx * dx + dy * dy + dz * dz;
  }
}

// ============================================================================
// ЇЖА (ЕНЕРГОКРИСТАЛИ)
// ============================================================================

/**
 * Енергокристал — джерело енергії для травоїдних
 *
 * Характеристики:
 * - Статичний об'єкт
 * - Зникає при споживанні
 * - Візуально анімований (обертання, пульсація)
 */
export class Food extends Entity {
  public readonly type = EntityType.FOOD;
  public readonly energyValue: number;

  /** Час створення для анімації */
  public readonly spawnTime: number;

  /** Чи було спожито */
  public consumed: boolean = false;

  constructor(id: FoodId, position: MutableVector3, energyValue: number = FOOD_ENERGY_VALUE) {
    super(id, position, 2);
    this.energyValue = energyValue;
    this.spawnTime = Date.now();
  }

  /** Фабричний метод для створення їжі */
  static create(idCounter: number, x: number, y: number, z: number): Food {
    return new Food(
      createFoodId(`food_${idCounter}`),
      { x, y, z },
      FOOD_ENERGY_VALUE
    );
  }
}

// ============================================================================
// ПЕРЕШКОДА (АНОМАЛІЯ)
// ============================================================================

/**
 * Просторова аномалія — перешкода для руху
 *
 * Характеристики:
 * - Статичний об'єкт
 * - Відштовхує організми при зіткненні
 * - Різні візуальні стилі
 */
export class Obstacle extends Entity {
  public readonly type = EntityType.OBSTACLE;
  public readonly color: number;
  public readonly opacity: number;

  /** Чи є wireframe (каркасний режим) */
  public readonly isWireframe: boolean;

  constructor(
    id: ObstacleId,
    position: MutableVector3,
    radius: number,
    color: number,
    opacity: number,
    isWireframe: boolean = false
  ) {
    super(id, position, radius);
    this.color = color;
    this.opacity = opacity;
    this.isWireframe = isWireframe;
  }

  /** Фабричний метод для створення аномалії */
  static create(
    idCounter: number,
    x: number,
    y: number,
    z: number,
    radius: number
  ): Obstacle {
    return new Obstacle(
      createObstacleId(`obs_${idCounter}`),
      { x, y, z },
      radius,
      COLORS.obstacle.base + Math.floor(Math.random() * 0x222222),
      0.3 + Math.random() * 0.5,
      Math.random() > 0.7
    );
  }
}

// ============================================================================
// ОРГАНІЗМ (ТРАВОЇДНИЙ / ХИЖАК)
// ============================================================================

/**
 * Живий організм з геномом, енергією та поведінкою
 *
 * Реалізує:
 * - Фізику руху (velocity, acceleration)
 * - Метаболізм (втрата енергії)
 * - Стан (IDLE, SEEKING, FLEEING, etc.)
 * - Генетичну інформацію
 */
export class Organism extends Entity {
  public readonly type: typeof EntityType.PREY | typeof EntityType.PREDATOR;

  // Фізика
  public velocity: MutableVector3;
  public acceleration: MutableVector3;

  // Стан життя
  public energy: number;
  public age: number = 0;
  public state: OrganismState = OrganismState.IDLE;
  public isDead: boolean = false;
  public causeOfDeath: 'starvation' | 'predation' | 'old_age' | null = null;

  // Візуалізація
  public trailEnabled: boolean = false;

  // Генетика
  public readonly genome: Genome;

  /** ID батьківського організму (для родоводу) */
  public readonly parentOrganismId: OrganismId | null;

  /** Лічильник успішних полювань (для хижаків) */
  public huntSuccessCount: number = 0;

  /** Останній тік активності (для оптимізації) */
  public lastActiveAt: number = 0;

  constructor(
    id: OrganismId,
    position: MutableVector3,
    genome: Genome,
    parentOrganismId: OrganismId | null = null
  ) {
    super(id, position, genome.size);
    this.genome = genome;
    this.type = genome.type as typeof EntityType.PREY | typeof EntityType.PREDATOR;
    this.parentOrganismId = parentOrganismId;

    // Ініціалізація фізики
    this.velocity = {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
    };
    this.acceleration = vec3Zero();

    // Ініціалізація енергії
    this.energy = INITIAL_ENERGY;
  }

  /** Чи є травоїдним */
  get isPrey(): boolean {
    return this.type === EntityType.PREY;
  }

  /** Чи є хижаком */
  get isPredator(): boolean {
    return this.type === EntityType.PREDATOR;
  }

  /** Нормалізована енергія (0-1) */
  get normalizedEnergy(): number {
    return Math.max(0, Math.min(1, this.energy / MAX_ENERGY));
  }

  /** Швидкість (магнітуда вектора velocity) */
  get speed(): number {
    return Math.sqrt(
      this.velocity.x * this.velocity.x +
      this.velocity.y * this.velocity.y +
      this.velocity.z * this.velocity.z
    );
  }

  /** Додати енергію */
  addEnergy(amount: number): void {
    this.energy = Math.min(MAX_ENERGY, this.energy + amount);
  }

  /** Витратити енергію */
  consumeEnergy(amount: number): void {
    this.energy -= amount;
    if (this.energy <= 0) {
      this.die('starvation');
    }
  }

  /** Померти */
  die(cause: 'starvation' | 'predation' | 'old_age'): void {
    if (!this.isDead) {
      this.isDead = true;
      this.causeOfDeath = cause;
      this.state = OrganismState.DYING;
    }
  }

  /** Оновити стан організму */
  updateState(newState: OrganismState): void {
    if (!this.isDead && this.state !== newState) {
      this.state = newState;
    }
  }

  /** Клонувати для рендерингу (імутабельний знімок) */
  toRenderData() {
    return {
      id: this.id as OrganismId,
      position: { ...this.position } as Vector3,
      velocity: { ...this.velocity } as Vector3,
      radius: this.radius,
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
// ФАБРИКА ГЕНОМІВ
// ============================================================================

/**
 * Генератор геномів з мутаціями
 */
export class GenomeFactory {
  private idCounter: number = 0;

  /** Згенерувати унікальний ID генома */
  private nextId(): GenomeId {
    return createGenomeId(`genome_${++this.idCounter}`);
  }

  /** Обмежити значення в межах min-max */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** Застосувати мутацію до значення */
  private mutate(value: number, mutationFactor: number): number {
    const factor = 1 - mutationFactor / 2 + Math.random() * mutationFactor;
    return value * factor;
  }

  /** Створити геном травоїдного */
  createPreyGenome(parent: PreyGenome | null = null): PreyGenome {
    const mf = GENETICS.mutationFactor;
    const base = GENETICS.preyBase;
    const min = GENETICS.min;
    const max = GENETICS.max;

    if (!parent) {
      return {
        id: this.nextId(),
        parentId: null,
        generation: 1,
        type: EntityType.PREY,
        color: COLORS.prey.base,
        maxSpeed: base.maxSpeed + (Math.random() - 0.5) * 0.5,
        senseRadius: base.senseRadius + (Math.random() - 0.5) * 20,
        metabolism: base.metabolism + (Math.random() - 0.5) * 0.2,
        size: base.size + (Math.random() - 0.5) * 1,
        asymmetry: Math.random() * 0.3,
        spikiness: Math.random() * 0.2,
        glowIntensity: 0.3 + Math.random() * 0.3,
        flockingStrength: base.flockingStrength + (Math.random() - 0.5) * 0.2,
      };
    }

    return {
      id: this.nextId(),
      parentId: parent.id,
      generation: parent.generation + 1,
      type: EntityType.PREY,
      color: COLORS.prey.base,
      maxSpeed: this.clamp(this.mutate(parent.maxSpeed, mf), min.maxSpeed, max.maxSpeed),
      senseRadius: this.clamp(this.mutate(parent.senseRadius, mf), min.senseRadius, max.senseRadius),
      metabolism: this.clamp(this.mutate(parent.metabolism, mf), min.metabolism, max.metabolism),
      size: this.clamp(this.mutate(parent.size, mf), min.size, max.size),
      asymmetry: this.clamp(this.mutate(parent.asymmetry, mf * 2), min.asymmetry, max.asymmetry),
      spikiness: this.clamp(this.mutate(parent.spikiness, mf * 2), min.spikiness, max.spikiness),
      glowIntensity: this.clamp(this.mutate(parent.glowIntensity, mf), min.glowIntensity, max.glowIntensity),
      flockingStrength: this.clamp(this.mutate(parent.flockingStrength, mf), 0, 1),
    };
  }

  /** Створити геном хижака */
  createPredatorGenome(parent: PredatorGenome | null = null): PredatorGenome {
    const mf = GENETICS.mutationFactor;
    const base = GENETICS.predatorBase;
    const min = GENETICS.min;
    const max = GENETICS.max;

    // Випадковий підтип для нових хижаків
    const subtypes: PredatorSubtype[] = ['HUNTER', 'AMBUSHER', 'PACK'];
    const randomSubtype = subtypes[Math.floor(Math.random() * subtypes.length)];

    if (!parent) {
      const subConfig = PREDATOR_SUBTYPES[randomSubtype];
      return {
        id: this.nextId(),
        parentId: null,
        generation: 1,
        type: EntityType.PREDATOR,
        subtype: randomSubtype,
        color: subConfig.color,
        maxSpeed: base.maxSpeed * subConfig.speedMultiplier + (Math.random() - 0.5) * 0.5,
        senseRadius: base.senseRadius * subConfig.senseMultiplier + (Math.random() - 0.5) * 30,
        metabolism: base.metabolism + (Math.random() - 0.5) * 0.2,
        size: base.size + (Math.random() - 0.5) * 1.5,
        asymmetry: Math.random() * 0.4,
        spikiness: 0.3 + Math.random() * 0.4,
        glowIntensity: 0.4 + Math.random() * 0.4,
        attackPower: base.attackPower * subConfig.attackMultiplier,
        packAffinity: base.packAffinity + (Math.random() - 0.5) * 0.2,
      };
    }

    // Успадкування підтипу з невеликим шансом мутації
    const inheritedSubtype = Math.random() < 0.9 ? parent.subtype : randomSubtype;
    const subConfig = PREDATOR_SUBTYPES[inheritedSubtype];

    return {
      id: this.nextId(),
      parentId: parent.id,
      generation: parent.generation + 1,
      type: EntityType.PREDATOR,
      subtype: inheritedSubtype,
      color: subConfig.color,
      maxSpeed: this.clamp(this.mutate(parent.maxSpeed, mf), min.maxSpeed, max.maxSpeed),
      senseRadius: this.clamp(this.mutate(parent.senseRadius, mf), min.senseRadius, max.senseRadius),
      metabolism: this.clamp(this.mutate(parent.metabolism, mf), min.metabolism, max.metabolism),
      size: this.clamp(this.mutate(parent.size, mf), min.size, max.size),
      asymmetry: this.clamp(this.mutate(parent.asymmetry, mf * 2), min.asymmetry, max.asymmetry),
      spikiness: this.clamp(this.mutate(parent.spikiness, mf * 2), min.spikiness, max.spikiness),
      glowIntensity: this.clamp(this.mutate(parent.glowIntensity, mf), min.glowIntensity, max.glowIntensity),
      attackPower: this.clamp(this.mutate(parent.attackPower, mf), 0.5, 2.0),
      packAffinity: this.clamp(this.mutate(parent.packAffinity, mf), 0, 1),
    };
  }

  /** Створити геном на основі батьківського */
  createFromParent(parentGenome: Genome): Genome {
    if (isPreyGenome(parentGenome)) {
      return this.createPreyGenome(parentGenome);
    } else {
      return this.createPredatorGenome(parentGenome);
    }
  }

  /** Скинути лічильник (для тестів) */
  reset(): void {
    this.idCounter = 0;
  }
}

// ============================================================================
// ФАБРИКА ОРГАНІЗМІВ
// ============================================================================

/**
 * Централізоване створення організмів
 */
export class OrganismFactory {
  private idCounter: number = 0;
  private genomeFactory: GenomeFactory = new GenomeFactory();

  /** Згенерувати унікальний ID організму */
  private nextId(): OrganismId {
    return createOrganismId(`org_${++this.idCounter}`);
  }

  /** Створити травоїдного */
  createPrey(x: number, y: number, z: number): Organism {
    const genome = this.genomeFactory.createPreyGenome();
    return new Organism(this.nextId(), { x, y, z }, genome);
  }

  /** Створити хижака */
  createPredator(x: number, y: number, z: number): Organism {
    const genome = this.genomeFactory.createPredatorGenome();
    return new Organism(this.nextId(), { x, y, z }, genome);
  }

  /** Створити нащадка */
  createOffspring(parent: Organism): Organism {
    const childGenome = this.genomeFactory.createFromParent(parent.genome);

    // Невелике зміщення позиції від батька
    const offset = parent.radius * 2;
    const childPosition: MutableVector3 = {
      x: parent.position.x + (Math.random() - 0.5) * offset,
      y: parent.position.y + (Math.random() - 0.5) * offset,
      z: parent.position.z + (Math.random() - 0.5) * offset,
    };

    return new Organism(
      this.nextId(),
      childPosition,
      childGenome,
      parent.id as OrganismId
    );
  }

  /** Скинути лічильник (для тестів) */
  reset(): void {
    this.idCounter = 0;
    this.genomeFactory.reset();
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isOrganism(entity: Entity): entity is Organism {
  return entity.type === EntityType.PREY || entity.type === EntityType.PREDATOR;
}

export function isFood(entity: Entity): entity is Food {
  return entity.type === EntityType.FOOD;
}

export function isObstacle(entity: Entity): entity is Obstacle {
  return entity.type === EntityType.OBSTACLE;
}

export function isPrey(entity: Entity): entity is Organism {
  return entity.type === EntityType.PREY;
}

export function isPredator(entity: Entity): entity is Organism {
  return entity.type === EntityType.PREDATOR;
}
