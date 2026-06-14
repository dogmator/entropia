/**
 * Performance Utils - utilities for working with performance metrics.
 * Eliminates DRY violations in the monitoring system.
 */

// Constants for PerformanceUtils
const BYTES_K = 1024;
const MS_PER_SECOND = 1000;
const MICROSECONDS_PER_MS = 1000;
const MEMORY_TREND_HISTORY_MIN = 3;
const MEMORY_TREND_WINDOW = 10;
const MEMORY_TREND_THRESHOLD = 0.05;
const STABILITY_MIN_VALUES = 10;
const STABILITY_CRITICAL_THRESHOLD = 20;
const STABILITY_UNSTABLE_THRESHOLD = 10;
const FRAME_TIME_INVERT_MAX = 100;
const DECIMALS_2 = 2;
const PERCENT_SCALE = 100;
const MOVING_AVG_SQUARE_EXP = 2;

// Shared constants for performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  FPS: { good: 55, warning: 30 },
  TPS: { good: 55, warning: 30 },
  FRAME_TIME: { good: 16.67, warning: 33.33 },
  MEMORY_USAGE: { good: 70, warning: 85 }
} as const;

// Formatting utilities
export const FormatUtils = {
  /**
   * Formatting bytes into human-readable format.
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) { return '0 B'; }
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(BYTES_K));
    const formatted = (bytes / Math.pow(BYTES_K, i)).toFixed(DECIMALS_2);
    return `${String(parseFloat(formatted))} ${String(sizes[i])}`;
  },

  /**
   * Formatting time in milliseconds.
   */
  formatTime(ms: number): string {
    if (ms < 1) { return `${(ms * MICROSECONDS_PER_MS).toFixed(1)}μs`; }
    if (ms < MS_PER_SECOND) { return `${ms.toFixed(1)}ms`; }
    return `${(ms / MS_PER_SECOND).toFixed(DECIMALS_2)}s`;
  },

  /**
   * Formatting percentages.
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
};

// Color indication utilities
export const ColorUtils = {
  /**
   * Getting color based on performance thresholds.
   */
  getPerformanceColor(value: number, thresholds: { good: number; warning: number }): string {
    if (value >= thresholds.good) { return 'text-emerald-400'; }
    if (value >= thresholds.warning) { return 'text-yellow-400'; }
    return 'text-red-400';
  },

  /**
   * Getting color for memory usage.
   */
  getMemoryColor(usage: number): string {
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.good) { return 'text-emerald-400'; }
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.warning) { return 'text-yellow-400'; }
    return 'text-red-400';
  },

  /**
   * Getting color for FPS.
   */
  getFPSColor(fps: number): string {
    return ColorUtils.getPerformanceColor(fps, PERFORMANCE_THRESHOLDS.FPS);
  },

  /**
   * Getting color for TPS.
   */
  getTPSColor(tps: number): string {
    return ColorUtils.getPerformanceColor(tps, PERFORMANCE_THRESHOLDS.TPS);
  },

  /**
   * Getting color for frame time.
   */
  getFrameTimeColor(frameTime: number): string {
    // Inverted thresholds for frame time (less is better)
    const invertedValue = Math.max(0, FRAME_TIME_INVERT_MAX - frameTime);
    const thresholds = {
      good: FRAME_TIME_INVERT_MAX - PERFORMANCE_THRESHOLDS.FRAME_TIME.warning,
      warning: FRAME_TIME_INVERT_MAX - PERFORMANCE_THRESHOLDS.FRAME_TIME.good
    };
    return ColorUtils.getPerformanceColor(invertedValue, thresholds);
  }
};

// Memory utilities
export const MemoryUtils = {
  /**
   * Getting browser memory info.
   */
  getCurrentMemoryInfo(): MemoryInfo | undefined {
    if ('memory' in performance) {
      const memory = (performance as Record<string, unknown>)['memory'] as MemoryInfo;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return undefined;
  },

  /**
   * Calculating memory usage percentage.
   */
  getMemoryUsagePercentage(memoryInfo: MemoryInfo): number {
    return (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * PERCENT_SCALE;
  },

  /**
   * Determining memory usage trend.
   */
  getMemoryTrend(history: MemoryInfo[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < MEMORY_TREND_HISTORY_MIN) { return 'stable'; }

    const recent = history.slice(-MEMORY_TREND_WINDOW);
    const first = recent[0]?.usedJSHeapSize;
    const last = recent[recent.length - 1]?.usedJSHeapSize;
    if (first === undefined || last === undefined) { return 'stable'; }
    const change = (last - first) / first;

    if (change > MEMORY_TREND_THRESHOLD) { return 'increasing'; }
    if (change < -MEMORY_TREND_THRESHOLD) { return 'decreasing'; }
    return 'stable';
  }
};

// Performance analysis utilities
export const AnalysisUtils = {
  /**
   * Calculating moving average.
   */
  calculateMovingAverage(values: number[], windowSize: number): number {
    if (values.length === 0) { return 0; }
    const start = Math.max(0, values.length - windowSize);
    let sum = 0;
    for (let i = start; i < values.length; i++) {
      const v = values[i];
      if (v !== undefined) {
        sum += v;
      }
    }
    return sum / (values.length - start);
  },

  /**
   * Quick median calculation.
   */
  quickMedian(values: number[]): number {
    if (values.length === 0) { return 0; }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / DECIMALS_2);
    const midVal = sorted[mid];
    const prevVal = sorted[mid - 1];

    if (midVal === undefined) return 0;

    return sorted.length % DECIMALS_2 === 0 && prevVal !== undefined
      ? (prevVal + midVal) / DECIMALS_2
      : midVal;
  },

  /**
   * Standard deviation calculation.
   */
  calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) { return 0; }
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, MOVING_AVG_SQUARE_EXP));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  },

  /**
   * Determining performance stability.
   */
  getPerformanceStability(values: number[]): 'stable' | 'unstable' | 'critical' {
    if (values.length < STABILITY_MIN_VALUES) { return 'stable'; }

    const stdDev = AnalysisUtils.calculateStandardDeviation(values);
    const mean = AnalysisUtils.calculateMovingAverage(values, values.length);
    const coefficientOfVariation = (stdDev / mean) * PERCENT_SCALE;

    if (coefficientOfVariation > STABILITY_CRITICAL_THRESHOLD) { return 'critical'; }
    if (coefficientOfVariation > STABILITY_UNSTABLE_THRESHOLD) { return 'unstable'; }
    return 'stable';
  }
};

// Time utilities
export const TimeUtils = {
  /**
   * Getting current time with high precision.
   */
  now(): number {
    return performance.now();
  },

  /**
   * Creating a timer with automatic cleanup.
   */
  createTimer(callback: () => void, interval: number): ReturnType<typeof setInterval> {
    return setInterval(callback, interval);
  },

  /**
   * Timer cleanup.
   */
  clearTimer(timer: ReturnType<typeof setInterval> | null): void {
    if (timer) {
      clearInterval(timer);
    }
  },

  /**
   * Creating requestAnimationFrame with automatic cleanup.
   */
  requestAnimationFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  },

  /**
   * requestAnimationFrame cleanup.
   */
  cancelAnimationFrame(frameId: number | null): void {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
  }
};

// Interfaces
export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceThresholds {
  good: number;
  warning: number;
}

// Combined utilities for convenience
export const PerformanceHelpers = {
  format: FormatUtils,
  color: ColorUtils,
  memory: MemoryUtils,
  analysis: AnalysisUtils,
  time: TimeUtils,
  thresholds: PERFORMANCE_THRESHOLDS
};
