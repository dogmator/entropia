
/**
 * Entropia 3D — Центральна Конфігурація
 *
 * Усі константи симуляції з академічними коментарями
 * щодо їх біологічного та фізичного обґрунтування
 */

// ============================================================================
// ПАРАМЕТРИ СВІТУ
// ============================================================================

/** Розмір кубічного світу в одиницях простору */
export const WORLD_SIZE = 600;

/** Розмір комірки просторового хешування для O(1) пошуку сусідів */
export const CELL_SIZE = 80;

/** Максимальна кількість організмів для підтримки 60 FPS */
export const MAX_TOTAL_ORGANISMS = 200;

// ============================================================================
// ПОЧАТКОВІ ПОПУЛЯЦІЇ (Lotka-Volterra equilibrium)
// ============================================================================

/**
 * Початкова популяція травоїдних
 * Співвідношення ~5:1 до хижаків відповідає екологічним моделям
 */
export const INITIAL_PREY = 120;

/**
 * Початкова популяція хижаків
 * Нижча концентрація згідно з пірамідою біомаси
 */
export const INITIAL_PREDATOR = 25;

// ============================================================================
// РЕСУРСИ (Їжа / Енергокристали)
// ============================================================================

/** Максимальна кількість їжі у світі */
export const MAX_FOOD = 350;

/**
 * Ймовірність спавну їжі за тік
 * 0.4 * 60 FPS ≈ 24 одиниці їжі на секунду
 */
export const FOOD_SPAWN_RATE = 0.4;

/** Енергетична цінність одного кристала */
export const FOOD_ENERGY_VALUE = 35;

// ============================================================================
// МЕТАБОЛІЗМ (Термодинамічна модель ентропії)
// ============================================================================

/**
 * Метаболічні константи визначають швидкість втрати енергії
 *
 * Згідно з другим законом термодинаміки, будь-яка
 * впорядкована система потребує енергії для підтримки
 */
export const METABOLIC_CONSTANTS = {
  /** Базова вартість існування (дихання, гомеостаз) */
  exist: 0.04,

  /** Вартість руху, пропорційна квадрату швидкості (E = ½mv²) */
  move: 0.008,

  /** Вартість сенсорних систем (нейронна активність) */
  sense: 0.0008,

  /** Штраф за розмір (більші організми потребують більше енергії) */
  size: 0.002,
} as const;

// ============================================================================
// РЕПРОДУКЦІЯ
// ============================================================================

/** Поріг енергії для розмноження */
export const REPRODUCTION_ENERGY_THRESHOLD = 180;

/** Початкова енергія новонародженого */
export const INITIAL_ENERGY = 100;

/** Максимальна енергія організму */
export const MAX_ENERGY = 300;

/** Мінімальний вік для розмноження (у тіках) */
export const MIN_REPRODUCTION_AGE = 60;

// ============================================================================
// ФІЗИКА (Boids Algorithm + Steering Behaviors)
// ============================================================================

export const PHYSICS = {
  /** Часовий крок симуляції */
  dt: 1 / 60,

  /** Коефіцієнт тертя/опору середовища */
  drag: 0.96,

  /** Вага сили сепарації (уникання зіткнень) */
  separationWeight: 2.5,

  /** Вага сили вирівнювання (стадна поведінка) */
  alignmentWeight: 1.2,

  /** Вага сили згуртування (тяжіння до групи) */
  cohesionWeight: 1.0,

  /** Вага сили пошуку цілі (їжа/жертва) */
  seekWeight: 3.5,

  /** Вага сили уникання (хижак/перешкода) */
  avoidWeight: 3.5,

  /** Максимальна сила рулювання */
  maxSteeringForce: 0.5,
} as const;

// ============================================================================
// ГЕНЕТИКА
// ============================================================================

export const GENETICS = {
  /** Базовий коефіцієнт мутації (0.1 = 10%) */
  mutationFactor: 0.12,

  /** Мінімальні значення генів */
  min: {
    maxSpeed: 0.8,
    senseRadius: 25,
    metabolism: 0.5,
    size: 2.5,
    asymmetry: 0,
    spikiness: 0,
    glowIntensity: 0.2,
  },

  /** Максимальні значення генів */
  max: {
    maxSpeed: 4.5,
    senseRadius: 200,
    metabolism: 2.0,
    size: 10,
    asymmetry: 1,
    spikiness: 1,
    glowIntensity: 1,
  },

  /** Базові значення для травоїдних */
  preyBase: {
    maxSpeed: 2.2,
    senseRadius: 90,
    metabolism: 1.0,
    size: 4,
    flockingStrength: 0.5,
  },

  /** Базові значення для хижаків */
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
// ПІДТИПИ ХИЖАКІВ
// ============================================================================

export const PREDATOR_SUBTYPES = {
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
// ЕКОЛОГІЧНІ ЗОНИ
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
// UI / ВІЗУАЛІЗАЦІЯ
// ============================================================================

export const UI_CONFIG = {
  /** Максимальна ширина бокової панелі */
  sidebarMaxWidth: '380px',

  /** Кількість точок історії для графіка */
  historyLength: 120,

  /** Частота оновлення UI (кожні N тіків) */
  updateFrequency: 15,
} as const;

/** Початкові налаштування візуалізації */
export const INITIAL_VIS_CONFIG = {
  organismOpacity: 0.92,
  foodOpacity: 0.85,
  organismScale: 1.0,
  foodScale: 1.2,
  showGrid: true,
  gridOpacity: 0.08,
  bloomIntensity: 0.8,
  trailLength: 80,
  showEnergyGlow: true,
  showTrails: true,              // Шлейфи за організмами
  showParticles: true,           // Частинки (фон, ефекти)
  showOrbitalSatellites: true,   // Орбітальні супутники біля кристалів їжі
  graphicsQuality: 'HIGH' as const, // Початковий рівень якості
} as const;

/** Graphics Quality Presets */
export const GRAPHICS_PRESETS = {
  LOW: {
    organismOpacity: 0.85,
    foodOpacity: 0.80,
    organismScale: 0.8,
    foodScale: 1.0,
    gridOpacity: 0.03,
    bloomIntensity: 0.3,
    trailLength: 20,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    showOrbitalSatellites: false,
  },
  MEDIUM: {
    organismOpacity: 0.88,
    foodOpacity: 0.82,
    organismScale: 0.9,
    foodScale: 1.1,
    gridOpacity: 0.05,
    bloomIntensity: 0.5,
    trailLength: 40,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: false,
    showOrbitalSatellites: false,
  },
  HIGH: {
    organismOpacity: 0.92,
    foodOpacity: 0.85,
    organismScale: 1.0,
    foodScale: 1.2,
    gridOpacity: 0.08,
    bloomIntensity: 0.8,
    trailLength: 80,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    showOrbitalSatellites: true,
  },
  ULTRA: {
    organismOpacity: 0.95,
    foodOpacity: 0.90,
    organismScale: 1.2,
    foodScale: 1.4,
    gridOpacity: 0.12,
    bloomIntensity: 1.0,
    trailLength: 120,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    showOrbitalSatellites: true,
  },
} as const;

// ============================================================================
// РЕНДЕРИНГ
// ============================================================================

export const RENDER = {
  /** Максимальна кількість інстансів для InstancedMesh */
  maxInstances: 2000,

  /** Максимальна кількість частинок на організм */
  maxTrailParticles: 120,

  /** Максимальна кількість частинок ефектів */
  maxEffectParticles: 5000,

  /** FPS для вимірювання продуктивності */
  targetFPS: 60,

  /** Bloom параметри */
  bloom: {
    strength: 0.6,
    radius: 0.4,
    threshold: 0.2,
  },
} as const;

// ============================================================================
// КОЛЬОРИ
// ============================================================================

export const COLORS = {
  prey: {
    base: 0x44ff88,
    glow: 0x88ffaa,
    death: 0x88ff88,
  },
  predator: {
    base: 0xff4466,
    glow: 0xff6688,
    death: 0xff8888,
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
// ЗВУКИ (для майбутньої аудіо-інтеграції)
// ============================================================================

export const AUDIO = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.3,
  effectsVolume: 0.7,
} as const;
