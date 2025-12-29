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
