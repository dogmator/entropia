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

  /**
   * Обчислення квадрата евклідової відстані до цільової точки.
   * Використовується для оптимізації обчислень (виключає операцію вилучення кореня).
   */
  distanceSquaredTo(other: Vector3): number {
    const dx = this.position.x - other.x;
    const dy = this.position.y - other.y;
    const dz = this.position.z - other.z;
    return dx * dx + dy * dy + dz * dz;
  }
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

  constructor(id: FoodId, position: MutableVector3, energyValue: number = FOOD_ENERGY_VALUE) {
    super(id, position, 2);
    this.energyValue = energyValue;
    this.spawnTime = Date.now();
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
    parentOrganismId: OrganismId | null = null
  ) {
    super(id, position, genome.size);
    this.genome = genome;
    this.type = genome.type as typeof EntityType.PREY | typeof EntityType.PREDATOR;
    this.parentOrganismId = parentOrganismId;

    // Ініціалізація векторів фізичної взаємодії
    this.velocity = {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
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

  /** Генерація унікального дескриптора геному. */
  private nextId(): GenomeId {
    return createGenomeId(`genome_${++this.idCounter}`);
  }

  /** Математичне обмеження значення у заданому діапазоні. */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** Реалізація механізму стохастичної модуляції ознаки (мутація). */
  private mutate(value: number, mutationFactor: number): number {
    const factor = 1 - mutationFactor / 2 + Math.random() * mutationFactor;
    return value * factor;
  }

  /** Формування геному для трофічного рівня травоїдних. */
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

  /** Формування геному для трофічного рівня хижаків. */
  createPredatorGenome(parent: PredatorGenome | null = null): PredatorGenome {
    const mf = GENETICS.mutationFactor;
    const base = GENETICS.predatorBase;
    const min = GENETICS.min;
    const max = GENETICS.max;

    // Стохастичний підбір еволюційного підтипу для первинної генерації
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

    // Спадкування та можлива трансформація підтипу
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
  private genomeFactory: GenomeFactory = new GenomeFactory();

  /** Генерація унікального системного ідентифікатора агента. */
  private nextId(): OrganismId {
    return createOrganismId(`org_${++this.idCounter}`);
  }

  /** Створення первинного екземпляра травоїдного організму. */
  createPrey(x: number, y: number, z: number): Organism {
    const genome = this.genomeFactory.createPreyGenome();
    return new Organism(this.nextId(), { x, y, z }, genome);
  }

  /** Створення первинного екземпляра хижого організму. */
  createPredator(x: number, y: number, z: number): Organism {
    const genome = this.genomeFactory.createPredatorGenome();
    return new Organism(this.nextId(), { x, y, z }, genome);
  }

  /** Ініціалізація створення нащадка з наслідуванням та зміщенням координат. */
  createOffspring(parent: Organism): Organism {
    const childGenome = this.genomeFactory.createFromParent(parent.genome);

    // Просторова девіація нащадка відносно локації батька
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
