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
export const WORLD_SIZE = 600;

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
const VOLUME_EXPONENT_VAL = 3;

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

  /** Шаг буфера для організмів (x, y, z, vx, vy, vz, r, type, id, state, energy, age, health) */
  ORGANISM_STRIDE: 13,

  /** Шаг буфера для їжі (x, y, z, r, id) */
  FOOD_STRIDE: 5,

  /** Радіус зони дії сили сепарації. */
  separationRadius: 18,

  /** Дистанція початку ухилення від перешкод. */
  obstacleAvoidanceDistance: 25,

  /** Мала величина для запобігання діленню на нуль. */
  EPSILON: 0.001,

  /** Зміщення радіусу пошуку колізій. */
  COLLISION_SEARCH_RADIUS_OFFSET: 20,

  /** Вага сили уникнення перешкод. */
  OBSTACLE_AVOIDANCE_WEIGHT: 12,
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
  foodInstanceMultiplier: 2,

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

  /** Константи для геометрії та матеріалів сутностей. */
  geometry: {
    organism: {
      radius: 0.8,
      height: 2.5,
      segments: 12,
    },
    food: {
      radius: 2,
      segments: 8,
    },
    velocityThreshold: 0.01,
  },

  materials: {
    opacity: 0.92,
    foodOpacity: 0.85,
    shininess: {
      prey: 30,
      predator: 40,
      food: 100,
    },
    emissiveIntensity: {
      prey: 0.15,
      predator: 0.2,
      food: 0.5,
    },
  },

  interaction: {
    hoverInterval: 0.1,
    foodRotationSpeed: 0.5,
    foodRotationSecondary: 0.3,
    foodScaleBase: 1.25,
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
export const TIME = {
  MS_IN_SECOND: 1000,
  SECONDS_IN_MINUTE: 60,
  MINUTES_IN_HOUR: 60,
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

  /** Брейкпоінти адаптивності. */
  breakpoints: {
    mobile: 768,
  },
} as const;

export const AUDIO = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.3,
  effectsVolume: 0.7,
} as const;

// ============================================================================
// UI THRESHOLDS & FORMATTING
// ============================================================================

export const UI_THRESHOLDS = {
  FPS: {
    HIGH: 55,
    MEDIUM: 30,
  },
  EXTINCTION_RISK: {
    CRITICAL: 0.7,
    HIGH: 0.4,
    WARNING: 0.3,
  },
  DEBOUNCE_DELAY: 50,
} as const;

export const DIAGNOSTICS_CONFIG = {
  CHART: {
    REFRESH_RATE: 1000,
    HISTORY_LENGTH: 60,
    MARGINS: { top: 5, right: 30, left: 20, bottom: 5 },
    COLORS: {
      FPS: '#10b981',
      ENTITIES: '#60a5fa',
      MEMORY: '#f59e0b',
    },
    GRID_COLOR: '#333',
  },
  LOGS: {
    MAX_ENTRIES: 100,
    SCROLL_THRESHOLD: 50,
  },
} as const;

// ============================================================================
// ДИНАМІЧНА КОНФІГУРАЦІЯ СВІТУ (SCALING)
// ============================================================================

/**
 * Генерує конфігурацію світу з урахуванням масштабного коефіцієнта.
 * @param scale Масштабний коефіцієнт (за замовчуванням 1.0).
 */
export function createWorldConfig(scale: number = 1.0): WorldConfig {
  const volumeScale = Math.pow(scale, VOLUME_EXPONENT_VAL);

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

export const ENGINE_CONSTANTS = {
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

  // Екологічні зони - множники радіусів
  ZONE_OASIS_RADIUS_MULT: 0.15,
  ZONE_DESERT_RADIUS_MULT: 0.2,
  ZONE_HUNTING_RADIUS_MULT: 0.12,
  ZONE_SANCTUARY_RADIUS_MULT: 0.1,

  // Екологічні зони - множники позицій
  ZONE_HUNTING_X_MULT: 0.75,
  ZONE_HUNTING_Z_MULT: 0.25,
  ZONE_SANCTUARY_X_MULT: 0.25,
  ZONE_SANCTUARY_Z_MULT: 0.75,
  ZONE_CENTER_MULT: 0.5,

  // Конфігурація перешкод
  OBSTACLE_COUNT: 12,
  OBSTACLE_MIN_RADIUS: 12,
  OBSTACLE_RADIUS_RANGE: 25,

  // Початкові значення статистики
  INITIAL_GENERATION: 0,
  INITIAL_MAX_GENERATION: 1,
  INITIAL_STAT_VALUE: 0,

  // Параметри RNG та часу
  SEED_LIMIT: 0xffffffff,

  // Параметри ризику та популяції
  IDEAL_PREDATOR_RATIO: 0.1,
  RISK_SCALING_FACTOR: 0.5,
  EXTINCTION_RISK_ZERO: 0,
  EXTINCTION_RISK_DEAD: 1,
  EXTINCTION_RISK_NO_PREY: 0.8,
  EXTINCTION_RISK_NO_PREDATOR: 0.1,
  VOLUME_EXPONENT: 3,
  FULL_PERCENT: 100,
} as const;

// ============================================================================
// PERFORMANCE MONITORING CONSTANTS
// ============================================================================

/**
 * Константи для моніторингу продуктивності та налаштування порогових значень.
 */
export const PERFORMANCE_CONSTANTS = {
  // Буфери та розміри історії
  MAX_ENTRIES: 300,
  RING_BUFFER_SIZE: 60,
  RECENT_ENTRIES_WINDOW: 10,

  // Інтервали оновлення (мс)
  FPS_UPDATE_INTERVAL: 500,
  MEMORY_COLLECTION_INTERVAL: 5000,
  CLEANUP_INTERVAL: 30000,
  UPDATE_THRESHOLD: 1000,
  SLOW_MEMORY_INTERVAL: 10000,
  RECOVERY_TIMEOUT: 30000,
  QUICK_RECOVERY_TIMEOUT: 5000,
  AVG_PERFORMANCE_WINDOW: 60000,
  SHORT_AVG_WINDOW: 10000,

  // FPS пороги
  DEFAULT_FPS: 60,
  DEFAULT_TPS: 60,
  FPS_CRITICAL_LOW: 10,
  FPS_LOW: 15,
  FPS_MEDIUM: 30,
  FPS_GOOD: 50,

  // Часові пороги (мс)
  FRAME_TIME_WARNING: 20,
  FRAME_TIME_CRITICAL: 33,
  SUBSYSTEM_SLOW_THRESHOLD: 5,
  MIN_EXECUTION_TIME: 0.1,

  // Пороги пам'яті
  MEMORY_LEAK_THRESHOLD: 0.8,
  MEMORY_TREND_THRESHOLD: 0.05,
  MEMORY_TREND_NEG_THRESHOLD: -0.05,
  MIN_TREND_SAMPLES: 3,

  // Розрахунки FPS
  FPS_MIN: 0,
  FPS_MAX: 999,
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

// ============================================================================
// PARTICLE SYSTEM CONSTANTS
// ============================================================================

/**
 * Константи системи часток для візуальних ефектів.
 * Використовується в ParticleSystem для генерації death/birth/eat/hunt ефектів.
 */
export const PARTICLE_CONSTANTS = {
  // Death effect parameters
  DEATH_COUNT_PREDATOR: 40,
  DEATH_COUNT_PREY: 25,
  DEATH_SPEED_PREDATOR: 3,
  DEATH_SPEED_PREY: 2,
  DEATH_SIZE_PREDATOR: 4,
  DEATH_SIZE_PREY: 3,
  DEATH_LIFE_MIN: 0.8,
  DEATH_LIFE_ADDITIONAL: 0.4,

  // Birth effect parameters
  BIRTH_COUNT_RING: 30,
  BIRTH_SPEED: 2,
  BIRTH_LIFE: 0.6,
  BIRTH_SIZE: 3,
  BIRTH_COUNT_FLASH: 10,
  BIRTH_FLASH_SPEED: 1,
  BIRTH_FLASH_SIZE: 5,
  BIRTH_FLASH_LIFE: 0.3,
  BIRTH_Y_VARIANCE: 0.5,

  // Eat effect parameters
  EAT_COUNT: 8,
  EAT_SPEED: 1.5,
  EAT_SIZE: 2,
  EAT_LIFE: 0.4,

  // Hunt effect parameters
  HUNT_STEPS: 5,
  HUNT_SPEED: 0.5,
  HUNT_SIZE: 2,
  HUNT_LIFE: 0.3,

  // Update physics constants
  FRAME_RATE_MULTIPLIER: 60,
  DRAG_COEFFICIENT: 0.98,
  GRAVITY: 0.02,
  SIZE_SCALE_MIN: 0.5,
  SIZE_SCALE_FACTOR: 0.5,

  // Trail system constants
  TRAIL_TELEPORT_THRESHOLD_SQ: 2500,
  TRAIL_OPACITY: 0.6,

  // Color bit manipulation
  COLOR_SHIFT_R: 16,
  COLOR_SHIFT_G: 8,
  COLOR_MASK: 255,
  COLOR_DIVISOR: 255,

  // Geometry constants
  TWO_PI: Math.PI * 2,
  SPHERE_PHI_MULTIPLIER: 2,
  SPHERE_RANDOM_OFFSET: 1,
  VELOCITY_CENTER_OFFSET: 0.5,

  // Particle initialization constants
  DEFAULT_OPACITY: 1,
  DEFAULT_MAX_LIFE: 1,
  WHITE_COLOR: 0xffffff,

  // 3D vector constants
  SCALAR_COMPONENTS: 1,
  VECTOR3_COMPONENTS: 3,  // x, y, z
  X_OFFSET: 0,
  Y_OFFSET: 1,
  Z_OFFSET: 2,
  VECTOR2_OFFSET: 2,      // For component calculations
} as const;

// ============================================================================
// COSMIC BACKGROUND CONSTANTS
// ============================================================================

/**
 * Константи для космічного фону (зоряне поле та туманності).
 */
export const COSMIC_BACKGROUND_CONSTANTS = {
  // Star field parameters
  STAR_COUNT: 3000,
  STAR_RADIUS: 2000,
  STAR_RADIUS_MIN_FACTOR: 0.8,
  STAR_RADIUS_VARIATION: 0.4,
  STAR_SIZE_POWER: 3,
  STAR_SIZE_MULTIPLIER: 3,
  STAR_SIZE_BASE: 0.5,
  STAR_BRIGHTNESS_BASE: 0.5,
  STAR_BRIGHTNESS_VARIATION: 0.5,
  STAR_TWINKLE_BASE: 1,
  STAR_TWINKLE_VARIATION: 3,

  // Nebula parameters
  NEBULA_RADIUS: 1800,
  NEBULA_SEGMENTS: 64,
  NEBULA_ROTATION_Y: 0.01,
  NEBULA_ROTATION_X: 0.005,

  // 3D vector constants (reusing from PARTICLE_CONSTANTS)
  VECTOR3_COMPONENTS: 3,
  VECTOR2_MULTIPLIER: 2,
  SINGLE_COMPONENT: 1,
  TWO_PI: Math.PI * 2,
} as const;

// ============================================================================
// ENTITY CONSTANTS
// ============================================================================

/**
 * Константи для створення та мутації сутностей (організмів, їжі, перешкод).
 * Використовується в Entity.ts, GenomeFactory, OrganismFactory.
 */
export const ENTITY_CONSTANTS = {
  // Food properties
  FOOD_RADIUS: 2,

  // Prey genome creation variance
  PREY_SPEED_VARIANCE: 0.5,
  PREY_SENSE_VARIANCE: 20,
  PREY_METABOLISM_VARIANCE: 0.2,
  PREY_SIZE_VARIANCE: 1,
  PREY_ASYMMETRY_MAX: 0.3,
  PREY_SPIKINESS_MAX: 0.2,
  PREY_GLOW_MIN: 0.3,
  PREY_GLOW_VARIANCE: 0.3,
  PREY_FLOCKING_VARIANCE: 0.2,

  // Predator genome creation variance
  PREDATOR_SPEED_VARIANCE: 0.5,
  PREDATOR_SENSE_VARIANCE: 30,
  PREDATOR_METABOLISM_VARIANCE: 0.2,
  PREDATOR_SIZE_VARIANCE: 1.5,
  PREDATOR_ASYMMETRY_MAX: 0.4,
  PREDATOR_SPIKINESS_MIN: 0.3,
  PREDATOR_SPIKINESS_VARIANCE: 0.4,
  PREDATOR_GLOW_MIN: 0.4,
  PREDATOR_GLOW_VARIANCE: 0.4,
  PREDATOR_PACK_VARIANCE: 0.2,

  // Obstacle properties
  OBSTACLE_COLOR_VARIANCE: 0x222222,
  OBSTACLE_OPACITY_MIN: 0.3,
  OBSTACLE_OPACITY_VARIANCE: 0.5,
  OBSTACLE_WIREFRAME_THRESHOLD: 0.7,

  // Organism properties
  VELOCITY_RANGE: 2,
  OFFSPRING_RADIUS_MULTIPLIER: 2,

  // Trait mutation bounds
  TRAIT_MIN_BOUND: 0,
  TRAIT_MAX_BOUND: 1,
  TRAIT_MIN_ATTACK: 0.5,
  TRAIT_MAX_ATTACK: 2.0,
  TRAIT_MUTATION_FACTOR: 2,

  // Subtype inheritance
  SUBTYPE_INHERITANCE_PROBABILITY: 0.9,
} as const;