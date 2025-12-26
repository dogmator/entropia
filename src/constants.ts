import type { GraphicsQuality, PredatorSubtype, VisConfig, WorldConfig } from './types';

/**
 * Entropia 3D — Центральний реєстр детермінованих параметрів конфігурації.
 *
 * Містить вичерпний перелік констант симуляційного середовища з відповідним 
 * науково-теоретичним обґрунтуванням їх біологічної та фізичної природи.
 */

// ============================================================================
// ГЕОМЕТРИЧНІ ПАРАМЕТРИ ПРОСТОРОВОГО СЕРЕДОВИЩА
// ============================================================================

/** Лінійна розмірність кубічного домену віртуального світу в абстрактних одиницях простору. */
export const WORLD_SIZE = 400;

/** Параметр просторової дискретизації (розмір комірки хешування) для забезпечення алгоритмічної складності O(1) при пошуку сусідніх об'єктів. */
export const CELL_SIZE = 80;

/** Гранично допустима сумарна чисельність агентів для підтримання термінальної частоти рендерингу (60 FPS). */
export const MAX_TOTAL_ORGANISMS = 400;

// ============================================================================
// ПАРАМЕТРИ ПОЧАТКОВОГО СТАНУ ПОПУЛЯЦІЙ (Модель Лотки-Вольтерри)
// ============================================================================

/** Початковий обсяг вибірки травоїдних суб'єктів. */
export const INITIAL_PREY = 80;

/** Початковий обсяг вибірки хижих суб'єктів. */
export const INITIAL_PREDATOR = 8;

// ============================================================================
// РЕСУРСНА БАЗА (Енергетичні субстрати)
// ============================================================================

/** Максимально допустима кількість одиниць енергетичного субстрату в середовищі. */
export const MAX_FOOD = 300;

/** Інтенсивність генерації енергетичних ресурсів за одну ітерацію (тік). */
export const FOOD_SPAWN_RATE = 0.5;

/** Кількісний еквівалент енергетичної цінності одиничного ресурсу. */
export const FOOD_ENERGY_VALUE = 40;

// ============================================================================
// МЕТАБОЛІЧНІ ПРОЦЕСИ (Ентропійна модель термодинаміки)
// ============================================================================

export const METABOLIC_CONSTANTS = {
  /** Енергетичні витрати на підтримку базового гомеостазу та життєдіяльності. */
  exist: 0.03,

  /** Витрати на локомоцію, пропорційні кінетичній складовій. */
  move: 0.004,

  /** Витрати на функціонування сенсорних систем та обробку сигналів. */
  sense: 0.0005,

  /** Масштабний коефіцієнт (алометрична залежність витрат від розміру суб'єкта). */
  size: 0.001,
} as const;

export const METABOLIC_THRESHOLDS = {
  /** Рівень енергії для стану голоду (normalized < 0.5). */
  hunger: 0.5,
  /** Критичний рівень енергії для стану виснаження (normalized < 0.2). */
  critical: 0.2,
  /** Поріг старості (відносно максимального віку). */
  oldAgeRatio: 0.8,
} as const;

// ============================================================================
// МЕХАНІЗМИ РЕПРОДУКЦІЇ ТА ОНТОГЕНЕЗУ
// ============================================================================

export const REPRODUCTION = {
  /** Частка енергії, що зберігається батьківською особиною після поділу. */
  energyCostMultiplier: 0.45,
} as const;

/** Критичний енергетичний поріг, необхідний для ініціації процесу реплікації (розмноження). */
export const REPRODUCTION_ENERGY_THRESHOLD = 180;

/** Початковий енергетичний потенціал новоутвореного організму. */
export const INITIAL_ENERGY = 100;

/** Гранична енергоємність біологічного суб'єкта. */
export const MAX_ENERGY = 300;

/** Мінімальна тривалість життвого циклу (у ітераціях) до набуття репродуктивної спроможності. */
export const MIN_REPRODUCTION_AGE = 60;

// ============================================================================
// ФІЗИЧНІ МОДЕЛІ (Алгоритми Boids та рульова поведінка)
// ============================================================================

/** Стандартна частота оновлення фізики (FPS). */
const PHYSICS_TICK_RATE = 60;

/** Степінь масштабування об'єму для 3D простору. */
const VOLUME_EXPONENT = 3;

export const PHYSICS = {
  /** Дискретний крок інтегрування в часовій області. */
  dt: 1 / PHYSICS_TICK_RATE,

  /** Коефіцієнт динамічного опору (в'язкості) віртуального середовища. */
  drag: 0.96,

  /** Коефіцієнт сили сепарації (мінімізація просторових колізій). */
  separationWeight: 2.5,

  /** Коефіцієнт сили вирівнювання (моделювання групової когерентності). */
  alignmentWeight: 1.2,

  /** Коефіцієнт сили когезії (тяжіння до геометричного центру групи). */
  cohesionWeight: 1.0,

  /** Пріоритет вектора прагнення до цільового об'єкта (ресурс/жертва). */
  seekWeight: 3.5,

  /** Пріоритет вектора уникнення загроз (хижак/геометрична перешкода). */
  avoidWeight: 3.5,

  /** Максимально допустимий модуль сили рулювання. */
  maxSteeringForce: 0.5,

  /** Радіус зони дії сили сепарації. */
  separationRadius: 18,

  /** Дистанція початку ухилення від перешкод. */
  obstacleAvoidanceDistance: 25,
} as const;

// ============================================================================
// ПАРАМЕТРИ ВЗАЄМОДІЇ
// ============================================================================

export const INTERACTION = {
  /** Коефіцієнт дисипації енергії при відбитті від перешкод (0.8 = 20% втрат). */
  obstacleBounceDamping: 0.8,

  /** Модифікатор сили просторової корекції (виштовхування) для запобігання застряганню. */
  obstaclePushMultiplier: 1.1,

  /** ККД засвоєння енергії хижаком при поглинанні жертви. */
  predatorEnergyEfficiency: 0.6,

  /** Гарантований мінімум енергетичного притоку при полюванні. */
  minEnergyGain: 25,
} as const;

// ============================================================================
// ГЕНЕТИЧНИЙ АПАРАТ ТА ВАРІАТИВНІСТЬ
// ============================================================================

export const GENETICS = {
  /** Інтегральний коефіцієнт ймовірності мутаційних змін (0.12 еквівалентно 12%). */
  mutationFactor: 0.12,

  /** Нижні межі експресії генетичних ознак. */
  min: {
    maxSpeed: 0.8,
    senseRadius: 25,
    metabolism: 0.5,
    size: 2.5,
    asymmetry: 0,
    spikiness: 0,
    glowIntensity: 0.2,
  },

  /** Верхні межі експресії генетичних ознак. */
  max: {
    maxSpeed: 4.5,
    senseRadius: 200,
    metabolism: 2.0,
    size: 10,
    asymmetry: 1,
    spikiness: 1,
    glowIntensity: 1,
  },

  /** Базовий фенотип травоїдних суб'єктів. */
  preyBase: {
    maxSpeed: 2.2,
    senseRadius: 90,
    metabolism: 1.0,
    size: 4,
    flockingStrength: 0.5,
  },

  /** Базовий фенотип хижих суб'єктів. */
  predatorBase: {
    maxSpeed: 2.6,
    senseRadius: 160,
    metabolism: 1.2,
    size: 6,
    attackPower: 1.0,
    packAffinity: 0.3,
  },
} as const;

// ============================================================================
// КЛАСИФІКАЦІЯ СТРАТЕГІЙ ХИЖАКІВ
// ============================================================================

export const PREDATOR_SUBTYPES: Record<
  PredatorSubtype,
  {
    speedMultiplier: number;
    senseMultiplier: number;
    attackMultiplier: number;
    color: number;
  }
> = {
  HUNTER: {
    speedMultiplier: 1.3,
    senseMultiplier: 0.8,
    attackMultiplier: 0.7,
    color: 0xff4444,
  },
  AMBUSHER: {
    speedMultiplier: 0.7,
    senseMultiplier: 1.2,
    attackMultiplier: 1.4,
    color: 0xcc2222,
  },
  PACK: {
    speedMultiplier: 1.0,
    senseMultiplier: 1.0,
    attackMultiplier: 1.0,
    color: 0xff6666,
  },
} as const;

// ============================================================================
// ЕКОЛОГІЧНІ ЗОНИ ТА МОДИФІКАТОРИ СЕРЕДОВИЩА
// ============================================================================

export const ZONE_DEFAULTS = {
  OASIS: {
    foodMultiplier: 3.0,
    dangerMultiplier: 0.5,
    color: 0x44ff88,
  },
  DESERT: {
    foodMultiplier: 0.2,
    dangerMultiplier: 1.0,
    color: 0xffaa44,
  },
  HUNTING_GROUND: {
    foodMultiplier: 1.0,
    dangerMultiplier: 2.0,
    color: 0xff4444,
  },
  SANCTUARY: {
    foodMultiplier: 1.5,
    dangerMultiplier: 0.1,
    color: 0x4488ff,
  },
} as const;

// ============================================================================
// ПАРАМЕТРИ ПЕРЕГЛЯДУ ТА ВІЗУАЛІЗАЦІЇ
// ============================================================================

/** Конфігурація візуальних параметрів за замовчуванням. */
export const INITIAL_VIS_CONFIG: VisConfig = {
  organismOpacity: 0.92,
  foodOpacity: 0.85,
  organismScale: 1.0,
  foodScale: 1.2,
  showGrid: true,
  gridOpacity: 0.2,
  bloomIntensity: 0.8,
  trailLength: 80,
  showEnergyGlow: true,
  showTrails: true,
  showParticles: true,
  graphicsQuality: 'HIGH' as GraphicsQuality,
} as const;

/** Набори пресетів графічної інтенсивності. */
export const GRAPHICS_PRESETS: Record<
  Exclude<GraphicsQuality, 'CUSTOM'>,
  VisConfig
> = {
  LOW: {
    organismOpacity: 0.85,
    foodOpacity: 0.80,
    organismScale: 0.8,
    foodScale: 1.0,
    showGrid: false,
    gridOpacity: 0.03,
    bloomIntensity: 0.3,
    trailLength: 20,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    graphicsQuality: 'LOW',
  },
  MEDIUM: {
    organismOpacity: 0.88,
    foodOpacity: 0.82,
    organismScale: 0.9,
    foodScale: 1.1,
    showGrid: true,
    gridOpacity: 0.05,
    bloomIntensity: 0.5,
    trailLength: 40,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: false,
    graphicsQuality: 'MEDIUM',
  },
  HIGH: {
    organismOpacity: 0.92,
    foodOpacity: 0.85,
    organismScale: 1.0,
    foodScale: 1.2,
    showGrid: true,
    gridOpacity: 0.08,
    bloomIntensity: 0.8,
    trailLength: 80,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'HIGH',
  },
  ULTRA: {
    organismOpacity: 0.95,
    foodOpacity: 0.90,
    organismScale: 1.2,
    foodScale: 1.4,
    showGrid: true,
    gridOpacity: 0.12,
    bloomIntensity: 1.0,
    trailLength: 120,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'ULTRA',
  },
} as const;

// ============================================================================
// ПАРАМЕТРИ ГРАФІЧНОГО РЕНДЕРИНГУ
// ============================================================================

export const RENDER = {
  /** Гранична кількість екземплярів для InstancedMesh-структур. */
  maxInstances: 400,

  /** Кількісний ліміт часток у системах шлейфів. */
  maxTrailParticles: 120,

  /** Загальний ліміт часток для динамічних візуальних ефектів. */
  maxEffectParticles: 2500,

  /** Цільовий показник частоти зміни кадрів. */
  targetFPS: 60,

  /** Параметри обробки ефекту світіння (Bloom). */
  bloom: {
    strength: 0.6,
    radius: 0.4,
    threshold: 0.2,
  },
  enableTracertForAllOrganisms: true,
} as const;

// ============================================================================
// КОЛІРНА ПАЛІТРА
// ============================================================================

export const COLORS = {
  prey: {
    base: 0x44ff88,
    glow: 0x88ffaa,
    death: 0x88ff88,
    trail: 0x66ff99,
  },
  predator: {
    base: 0xff4466,
    glow: 0xff6688,
    death: 0xff8888,
    trail: 0xff6688,
  },
  food: {
    base: 0xffcc44,
    glow: 0xffdd66,
    emissive: 0xffaa00,
  },
  obstacle: {
    base: 0x8844ff,
    glow: 0xaa66ff,
  },
  ui: {
    background: 0x050505,
    accent: 0x10b981,
    danger: 0xef4444,
    warning: 0xf59e0b,
  },
} as const;

// ============================================================================
// КОНФІГУРАЦІЯ UI ТА АУДІО
// ============================================================================

export const UI_CONFIG = {
  /** Максимальна ширина інтерфейсної панелі. */
  sidebarMaxWidth: '380px',

  /** Глибина часового вікна для статистичного аналізу (кількість точок). */
  historyLength: 120,

  /** Періодичність оновлення графічних показників (через кожні N ітерацій). */
  updateFrequency: 15,
} as const;

export const AUDIO = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.3,
  effectsVolume: 0.7,
} as const;

// ============================================================================
// ДИНАМІЧНА КОНФІГУРАЦІЯ СВІТУ (SCALING)
// ============================================================================

/**
 * Генерує конфігурацію світу з урахуванням масштабного коефіцієнта.
 * @param scale Масштабний коефіцієнт (за замовчуванням 1.0).
 */
export function createWorldConfig(scale: number = 1.0): WorldConfig {
  const volumeScale = Math.pow(scale, VOLUME_EXPONENT);

  return {
    WORLD_SIZE: WORLD_SIZE * scale,
    // Масштабування ліміту популяції пропорційно об'єму (scale^3) для збереження щільності
    MAX_TOTAL_ORGANISMS: Math.floor(MAX_TOTAL_ORGANISMS * volumeScale),
    INITIAL_PREY: Math.floor(INITIAL_PREY * volumeScale),
    INITIAL_PREDATOR: Math.floor(INITIAL_PREDATOR * volumeScale),
    // Ресурси також масштабуються за об'ємом
    MAX_FOOD: Math.floor(MAX_FOOD * volumeScale),
    FOOD_SPAWN_RATE: FOOD_SPAWN_RATE * volumeScale,
  };
}

// ============================================================================
// ENGINE INTERNAL CONSTANTS
// ============================================================================

export
  const ENGINE_CONSTANTS = {
    MS_PER_SECOND: 1000,
    TRAIL_BUFFER_SIZE: 13,
    FOOD_BUFFER_SIZE: 5,
    MAX_DEPTH: 3,
    MAX_CELL_SIZE: 80,
    DEFAULT_CAMERA_FOV: 60,
    DEFAULT_ZOOM: 1,
    TICK_RATE: 60,
    HIT_RADIUS_MULT_ORG: 2.5,
    HIT_RADIUS_MULT_ORG_FALLBACK: 2,
    HIT_RADIUS_MULT_FOOD: 2,
    GRID_FALLBACK_MULT: 2,
    WORLD_AGE_FALLBACK_TPS: 60,
    BUFFER_GROWTH_FACTOR: 1.5,
    BUFFER_SHRINK_FACTOR: 1.25,
    BUFFER_MIN_CAPACITY: 100,
    EXTINCTION_THRESHOLD_LOW: 5,
    EXTINCTION_RISK_HIGH: 0.9,
    EXTINCTION_RISK_MEDIUM: 0.5,
    RISK_COLOR_THRESHOLD: 0.8,
    RISK_FACTOR_OFFSET: 0.1,
  } as const;

// ============================================================================
// OBJECT POOL CONSTANTS
// ============================================================================

export const POOL_CONSTANTS = {
  /** Стандартний початковий розмір пулу об'єктів. */
  DEFAULT_INITIAL_SIZE: 100,
  
  /** Стандартний максимальний розмір пулу об'єктів. */
  DEFAULT_MAX_SIZE: 10000,
  
  /** Початковий розмір для Vector3 пулу. */
  VECTOR3_INITIAL_SIZE: 500,
  
  /** Максимальний розмір для Vector3 пулу. */
  VECTOR3_MAX_SIZE: 5000,
  
  /** Початковий розмір для Particle пулу. */
  PARTICLE_INITIAL_SIZE: 2000,
  
  /** Максимальний розмір для Particle пулу. */
  PARTICLE_MAX_SIZE: 20000,
} as const;