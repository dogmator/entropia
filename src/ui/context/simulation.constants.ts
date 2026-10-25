export const SPEED_KEYS = {
    PAUSE: 0,
    NORMAL: 1,
    FAST: 2,
    TURBO: 5,
} as const;

export const FIXED_PRECISION = 2;
export const MS_PER_SECOND = 1000;
/** How often the canvas measurements reach the stats while the simulation may be paused. */
export const RENDER_METRICS_REFRESH_MS = 250;
