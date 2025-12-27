/**
 * Entropia 3D — Моделі сутностей симуляційного середовища.
 *
 * Реалізована академічно коректна ієрархія класів для наступних об'єктів:
 * - Організмів (продуценти/травоїдні та консументи/хижаки).
 * - Ресурсних одиниць (енергетичні субстрати/їжа).
 * - Структурних перешкод (просторові аномалії).
 *
 * Використовує механізм Discriminated Unions для забезпечення суворої типізації при зіставленні за зразком (Pattern Matching).
 */

import type { Random } from '@/core';

import {
  COLORS,
  ENTITY_CONSTANTS,
  FOOD_ENERGY_VALUE,
  GENETICS,
  INITIAL_ENERGY,
  MAX_ENERGY,
  PREDATOR_SUBTYPES,
} from '../constants';
import {
  createFoodId,
  createGenomeId,
  createObstacleId,
  createOrganismId,
  EntityType,
  isPreyGenome,
  OrganismState,
  // vec3Clone, // unused
  vec3Zero,
} from '../types';
import type {
  EntityId,
  FoodId,
  Genome,
  GenomeId,
  MutableVector3,
  ObstacleId,
  OrganismId,
  PredatorGenome,
  PredatorSubtype, PreyGenome,
  Vector3,
  // EntityType,
} from '../types.ts';

// ============================================================================
// АБСТРАКТНА БАЗОВА СУТНІСТЬ (ENTITY)
// ============================================================================

/**
 * Фундаментальний абстрактний клас для всіх об'єктів віртуального світу.
 */
export abstract class Entity {
  public abstract readonly type: EntityType;

  constructor(
    public readonly id: EntityId,
    public position: MutableVector3,
    public radius: number
  ) { }


}

// ============================================================================
// ЕНЕРГЕТИЧНИЙ СУБСТРАТ (FOOD)
// ============================================================================

/**
 * Енергетичний кристал — первинне джерело нутрієнтів для продуцентів.
 *
 * Характеристики:
 * - Статична просторова локалізація.
 * - Елімінація об'єкта при поглинанні.
 * - Наявність візуальних ефектів (ротація, осциляція яскравості).
 */
export class Food extends Entity {
  public readonly type = EntityType.FOOD;
  public readonly energyValue: number;

  /** Часова мітка ініціалізації для синхронізації анімацій. */
  public readonly spawnTime: number;

  /** Поточний статус споживання об'єкта. */
  public consumed: boolean = false;

  constructor(
    id: FoodId,
    position: MutableVector3,
    energyValue: number = FOOD_ENERGY_VALUE,
    spawnTime: number = Date.now()
  ) {
    super(id, position, ENTITY_CONSTANTS.FOOD_RADIUS);
    this.energyValue = energyValue;
    this.spawnTime = spawnTime;
  }

  /**
   * Статичний фабричний метод для екземпляризації об'єктів їжі.
   */
  static create(idCounter: number, x: number, y: number, z: number): Food {
    return new Food(
      createFoodId(`food_${idCounter}`),
      { x, y, z },
      FOOD_ENERGY_VALUE
    );
  }
}

// ============================================================================
// СТРУКТУРНА ПЕРЕШКОДА (OBSTACLE)
// ============================================================================

/**
 * Просторова аномалія — об'єкт, що обмежує вільне переміщення агентів.
 *
 * Характеристики:
 * - Статичний характер взаємодії.
 * - Формування векторів відштовхування при контакті.
 * - Варіативна візуальна репрезентація.
 */
export class Obstacle extends Entity {
  public readonly type = EntityType.OBSTACLE;
  public readonly color: number;
  public readonly opacity: number;

  /** Прапорець активації каркасного режиму відображення (Wireframe). */
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

  /**
   * Статичний фабричний метод для генерації об'єктів просторових аномалій.
   */
  static create(
    idCounter: number,
    x: number,
    y: number,
    z: number,
    radius: number,
    rng?: Random
  ): Obstacle {
    const rand = rng ? () => rng.next() : Math.random;
    return new Obstacle(
      createObstacleId(`obs_${idCounter}`),
      { x, y, z },
      radius,
      COLORS.obstacle.base + Math.floor(rand() * ENTITY_CONSTANTS.OBSTACLE_COLOR_VARIANCE),
      ENTITY_CONSTANTS.OBSTACLE_OPACITY_MIN + rand() * ENTITY_CONSTANTS.OBSTACLE_OPACITY_VARIANCE,
      rand() > ENTITY_CONSTANTS.OBSTACLE_WIREFRAME_THRESHOLD
    );
  }
}

// ============================================================================
// БІОЛОГІЧНИЙ АГЕНТ (ORGANISM)
// ============================================================================

/**
 * Динамічна одиниця симуляції, що володіє геномом, метаболізмом та логікою поведінки.
 *
 * Реалізовані механізми:
 * - Кінематичне моделювання (вектори швидкості та прискорення).
 * - Термодинамічний метаболізм (дисипація енергії).
 * - Скінченний автомат станів (State Machine: Спокій, Пошук, Втеча тощо).
 * - Збереження та передача генетичного коду.
 */
export class Organism extends Entity {
  public readonly type: typeof EntityType.PREY | typeof EntityType.PREDATOR;

  // Кінематичні характеристики
  public velocity: MutableVector3;
  public acceleration: MutableVector3;

  // Опис вітальних функцій та стану
  public energy: number;
  public age: number = 0;
  public state: OrganismState = OrganismState.IDLE;
  public isDead: boolean = false;
  public causeOfDeath: 'starvation' | 'predation' | 'old_age' | null = null;

  // Візуальні атрибути
  public trailEnabled: boolean = false;

  // Генетичний дескриптор
  public readonly genome: Genome;

  /** Посилання на ідентифікатор прабатька (для філогенетичного аналізу). */
  public readonly parentOrganismId: OrganismId | null;

  /** Реєстр успішних трофічних взаємодій (актуально для хижаків). */
  public huntSuccessCount: number = 0;

  /** Часова відмітка останньої активності для оптимізації оновлень. */
  public lastActiveAt: number = 0;

  constructor(
    id: OrganismId,
    position: MutableVector3,
    genome: Genome,
    parentOrganismId: OrganismId | null = null,
    rng?: Random
  ) {
    super(id, position, genome.size);
    this.genome = genome;
    this.type = genome.type as typeof EntityType.PREY | typeof EntityType.PREDATOR;
    this.parentOrganismId = parentOrganismId;

    const rand = rng ? () => rng.next() : Math.random;

    // Ініціалізація кінематичних векторів фізичної взаємодії
    this.velocity = {
      x: (rand() - 0.5) * ENTITY_CONSTANTS.VELOCITY_RANGE,
      y: (rand() - 0.5) * ENTITY_CONSTANTS.VELOCITY_RANGE,
      z: (rand() - 0.5) * ENTITY_CONSTANTS.VELOCITY_RANGE,
    };
    this.acceleration = vec3Zero();

    // Встановлення початкового енергетичного потенціалу
    this.energy = INITIAL_ENERGY;
  }

  /** Перевірка приналежності до трофічного рівня продуцентів/травоїдних. */
  get isPrey(): boolean {
    return this.type === EntityType.PREY;
  }

  /** Перевірка приналежності до трофічного рівня консументів/хижаків. */
  get isPredator(): boolean {
    return this.type === EntityType.PREDATOR;
  }

  /** Обчислення нормалізованого значення енергетичного запасу [0, 1]. */
  get normalizedEnergy(): number {
    return Math.max(0, Math.min(1, this.energy / MAX_ENERGY));
  }

  /** Обчислення скалярної величини швидкості (модуль вектора). */
  get speed(): number {
    return Math.sqrt(
      this.velocity.x * this.velocity.x +
      this.velocity.y * this.velocity.y +
      this.velocity.z * this.velocity.z
    );
  }

  /** Поповнення енергетичного депо організму. */
  addEnergy(amount: number): void {
    this.energy = Math.min(MAX_ENERGY, this.energy + amount);
  }

  /** Дисипація енергії та перевірка на критичний рівень виснаження. */
  consumeEnergy(amount: number): void {
    this.energy -= amount;
    if (this.energy <= 0) {
      this.die('starvation');
    }
  }

  /** Ініціалізація процесу термінальної елімінації (смерті). */
  die(cause: 'starvation' | 'predation' | 'old_age'): void {
    if (!this.isDead) {
      this.isDead = true;
      this.causeOfDeath = cause;
      this.state = OrganismState.DYING;
    }
  }

  /** Валідована зміна внутрішнього стану агента. */
  updateState(newState: OrganismState): void {
    if (!this.isDead && this.state !== newState) {
      this.state = newState;
    }
  }

  /** Формування імутабельного зрізу даних для підсистеми візуалізації. */
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
// ГЕНЕРАТОР ГЕНЕТИЧНИХ СТРУКТУР (GENOME FACTORY)
// ============================================================================

/**
 * Центр формування геномів з підтримкою стохастичних мутацій.
 */
export class GenomeFactory {
  private idCounter: number = 0;

  constructor(private readonly rng: Random) { }

  /** Генерація унікального дескриптора геному. */
  private nextId(): GenomeId {
    return createGenomeId(`genome_${++this.idCounter}`);
  }

  getIdCounter(): number {
    return this.idCounter;
  }

  setIdCounter(counter: number): void {
    this.idCounter = Math.max(0, counter);
  }

  /**
   * Уніфікований метод мутації генетичної ознаки з валідацією меж.
   */
  private mutateTrait(value: number, min: number, max: number, customFactor: number = 1): number {
    const mf = GENETICS.mutationFactor * customFactor;
    const factor = 1 - mf / 2 + this.rng.next() * mf;
    return Math.max(min, Math.min(max, value * factor));
  }

  /**
   * Мутація спільних ознак для всіх типів геномів.
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

  /** Формування геному для трофічного рівня травоїдних. */
  createPreyGenome(parent: PreyGenome | null = null): PreyGenome {
    if (!parent) {
      const base = GENETICS.preyBase;
      return {
        id: this.nextId(),
        parentId: null,
        generation: 1,
        type: EntityType.PREY,
        color: COLORS.prey.base,
        maxSpeed: base.maxSpeed + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREY_SPEED_VARIANCE,
        senseRadius: base.senseRadius + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREY_SENSE_VARIANCE,
        metabolism: base.metabolism + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREY_METABOLISM_VARIANCE,
        size: base.size + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREY_SIZE_VARIANCE,
        asymmetry: this.rng.next() * ENTITY_CONSTANTS.PREY_ASYMMETRY_MAX,
        spikiness: this.rng.next() * ENTITY_CONSTANTS.PREY_SPIKINESS_MAX,
        glowIntensity: ENTITY_CONSTANTS.PREY_GLOW_MIN + this.rng.next() * ENTITY_CONSTANTS.PREY_GLOW_VARIANCE,
        flockingStrength: base.flockingStrength + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREY_FLOCKING_VARIANCE,
      };
    }

    return {
      ...this.mutateCommonTraits(parent),
      id: this.nextId(),
      parentId: parent.id,
      generation: parent.generation + 1,
      type: EntityType.PREY,
      color: COLORS.prey.base,
      flockingStrength: this.mutateTrait(parent.flockingStrength, ENTITY_CONSTANTS.TRAIT_MIN_BOUND, ENTITY_CONSTANTS.TRAIT_MAX_BOUND),
    };
  }

  /** Формування геному для трофічного рівня хижаків. */
  createPredatorGenome(parent: PredatorGenome | null = null): PredatorGenome {
    const subtypes: PredatorSubtype[] = ['HUNTER', 'AMBUSHER', 'PACK'];
    const randomSubtype = subtypes[Math.floor(this.rng.next() * subtypes.length)]!;

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
        maxSpeed: base.maxSpeed * subConfig.speedMultiplier + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREDATOR_SPEED_VARIANCE,
        senseRadius: base.senseRadius * subConfig.senseMultiplier + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREDATOR_SENSE_VARIANCE,
        metabolism: base.metabolism + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREDATOR_METABOLISM_VARIANCE,
        size: base.size + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREDATOR_SIZE_VARIANCE,
        asymmetry: this.rng.next() * ENTITY_CONSTANTS.PREDATOR_ASYMMETRY_MAX,
        spikiness: ENTITY_CONSTANTS.PREDATOR_SPIKINESS_MIN + this.rng.next() * ENTITY_CONSTANTS.PREDATOR_SPIKINESS_VARIANCE,
        glowIntensity: ENTITY_CONSTANTS.PREDATOR_GLOW_MIN + this.rng.next() * ENTITY_CONSTANTS.PREDATOR_GLOW_VARIANCE,
        attackPower: base.attackPower * subConfig.attackMultiplier,
        packAffinity: base.packAffinity + (this.rng.next() - 0.5) * ENTITY_CONSTANTS.PREDATOR_PACK_VARIANCE,
      };
    }

    // Еволюційне спадкування та вероятнісна трансформація підтипу з коефіцієнтом 90%
    const inheritedSubtype = this.rng.next() < ENTITY_CONSTANTS.SUBTYPE_INHERITANCE_PROBABILITY ? parent.subtype : randomSubtype;
    const subConfig = PREDATOR_SUBTYPES[inheritedSubtype];

    return {
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
  }

  /** Генерація нового геному на підставі існуючого предка. */
  createFromParent(parentGenome: Genome): Genome {
    if (isPreyGenome(parentGenome)) {
      return this.createPreyGenome(parentGenome);
    } else {
      return this.createPredatorGenome(parentGenome);
    }
  }

  /** Ресет внутрішніх лічильників ідентифікаторів. */
  reset(): void {
    this.idCounter = 0;
  }
}

// ============================================================================
// ФАБРИКА ЕКЗЕМПЛЯРИЗАЦІЇ ОРГАНІЗМІВ (ORGANISM FACTORY)
// ============================================================================

/**
 * Керуючий центр створення та конфігурування живих агентів.
 */
export class OrganismFactory {
  private idCounter: number = 0;
  private genomeFactory: GenomeFactory;

  constructor(private readonly rng: Random) {
    this.genomeFactory = new GenomeFactory(rng);
  }

  /** Генерація унікального системного ідентифікатора агента. */
  private nextId(): OrganismId {
    return createOrganismId(`org_${++this.idCounter}`);
  }

  getIdCounter(): number {
    return this.idCounter;
  }

  setIdCounter(counter: number): void {
    this.idCounter = Math.max(0, counter);
  }

  getGenomeIdCounter(): number {
    return this.genomeFactory.getIdCounter();
  }

  setGenomeIdCounter(counter: number): void {
    this.genomeFactory.setIdCounter(counter);
  }

  /** Створення первинного екземпляра травоїдного організму. */
  createPrey(x: number, y: number, z: number): Organism {
    return this.createOrganism(
      this.genomeFactory.createPreyGenome(),
      { x, y, z }
    );
  }

  /** Створення первинного екземпляра хижого організму. */
  createPredator(x: number, y: number, z: number): Organism {
    return this.createOrganism(
      this.genomeFactory.createPredatorGenome(),
      { x, y, z }
    );
  }

  private createOrganism(genome: Genome, position: { x: number, y: number, z: number }): Organism {
    return new Organism(this.nextId(), position, genome, null, this.rng);
  }

  /** Ініціалізація створення нащадка з наслідуванням та зміщенням координат. */
  createOffspring(parent: Organism): Organism {
    const childGenome = this.genomeFactory.createFromParent(parent.genome);

    // Стохастичне просторове зміщення нащадка відносно локації батьківського організму
    const offset = parent.radius * ENTITY_CONSTANTS.OFFSPRING_RADIUS_MULTIPLIER;
    const childPosition: MutableVector3 = {
      x: parent.position.x + (this.rng.next() - 0.5) * offset,
      y: parent.position.y + (this.rng.next() - 0.5) * offset,
      z: parent.position.z + (this.rng.next() - 0.5) * offset,
    };

    return new Organism(
      this.nextId(),
      childPosition,
      childGenome,
      parent.id as OrganismId,
      this.rng
    );
  }

  /** Повна очистка стану фабрики. */
  reset(): void {
    this.idCounter = 0;
    this.genomeFactory.reset();
  }
}

// ============================================================================
// ПРЕП'ЯТСТВУЮЧІ ПЕРЕВІРКИ ТИПІВ (TYPE GUARDS)
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
