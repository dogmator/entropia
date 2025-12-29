/**
 * UI configuration and audio settings.
 * Interface parameters, thresholds, time utilities, and diagnostics.
 */

export const UI_CONFIG = {
  /** Maximum interface panel width. */
  sidebarMaxWidth: '380px',

  /** Time window depth for statistical analysis (number of points). */
  historyLength: 120,

  /** Graphics metrics update frequency (every N iterations). */
  updateFrequency: 15,

  /** Responsive breakpoints. */
  breakpoints: {
    mobile: 768,
  },

  /** Skeleton loading settings. */
  SKELETON: {
    COUNTS: {
      STATS: 4,
      TELEMETRY: 3,
    },
    ANIMATION: {
      DELAY_STEP_STATS: 75,
      DELAY_STEP_TELEMETRY: 100,
      DELAY_POPULATION_SECONDARY: 150,
    },
  },
} as const;

export const AUDIO = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.3,
  effectsVolume: 0.7,
} as const;

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

export const TIME = {
  MS_IN_SECOND: 1000,
  SECONDS_IN_MINUTE: 60,
  MINUTES_IN_HOUR: 60,
} as const;

export const DASHBOARD_CONFIG = {
  CHART: {
    DEBOUNCE_DELAY: 150,
    HEIGHT: { DEFAULT: 128, SM: 144, LG: 160 },
    MARGIN: { top: 10, right: 0, left: -30, bottom: 0 },
    STROKE_WIDTH: 2.5,
  },
  ANIMATION_DURATION: 300,
  PRECISION: { FIXED: 1 },
  PERCENT: 100,
} as const;

export const SETTINGS_PANEL_CONFIG = {
  VERSION: 'v2.5',
  MAX_HEIGHT: '1600px',
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

export const UI_CONTROLS = {
  SPEED: {
    DEFAULT: 1,
    MIN: 0,
    MAX: 5,
    STORAGE_KEY: 'entropia-speed',
  },
  WORLD_SCALE: {
    DEFAULT: 1.0,
    MIN: 0.1,
    MAX: 10,
    STORAGE_KEY: 'entropia-scale',
  },
  AUTO_ROTATE: {
    STORAGE_KEY_ENABLED: 'entropia-autorotate',
    STORAGE_KEY_SPEED: 'entropia-rotationspeed',
  },
  LOADING_DELAY: 500,
  SERVER_LOG_INTERVAL: 60,
} as const;
