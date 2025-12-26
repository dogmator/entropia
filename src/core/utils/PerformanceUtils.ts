/**
 * Performance Utils - утилиты для работы с метриками производительности
 * Устраняет нарушения DRY в системе мониторинга
 */

// Константи для PerformanceUtils
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

// Общие константы для порогов производительности
export const PERFORMANCE_THRESHOLDS = {
  FPS: { good: 55, warning: 30 },
  TPS: { good: 55, warning: 30 },
  FRAME_TIME: { good: 16.67, warning: 33.33 },
  MEMORY_USAGE: { good: 70, warning: 85 }
} as const;

// Утилиты для форматирования
export class FormatUtils {
  /**
   * Форматирование байтов в человекочитаемый формат
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) { return '0 B'; }
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(BYTES_K));
    return parseFloat((bytes / Math.pow(BYTES_K, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Форматирование времени в миллисекундах
   */
  public static formatTime(ms: number): string {
    if (ms < 1) { return `${(ms * MICROSECONDS_PER_MS).toFixed(1)}μs`; }
    if (ms < MS_PER_SECOND) { return `${ms.toFixed(1)}ms`; }
    return `${(ms / MS_PER_SECOND).toFixed(2)}s`;
  }

  /**
   * Форматирование процентов
   */
  public static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
}

// Утилиты для цветовой индикации
export class ColorUtils {
  /**
   * Получение цвета на основе порогов производительности
   */
  public static getPerformanceColor(value: number, thresholds: { good: number; warning: number }): string {
    if (value >= thresholds.good) { return 'text-emerald-400'; }
    if (value >= thresholds.warning) { return 'text-yellow-400'; }
    return 'text-red-400';
  }

  /**
   * Получение цвета для использования памяти
   */
  public static getMemoryColor(usage: number): string {
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.good) { return 'text-emerald-400'; }
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.warning) { return 'text-yellow-400'; }
    return 'text-red-400';
  }

  /**
   * Получение цвета для FPS
   */
  public static getFPSColor(fps: number): string {
    return ColorUtils.getPerformanceColor(fps, PERFORMANCE_THRESHOLDS.FPS);
  }

  /**
   * Получение цвета для TPS
   */
  public static getTPSColor(tps: number): string {
    return ColorUtils.getPerformanceColor(tps, PERFORMANCE_THRESHOLDS.TPS);
  }

  /**
   * Получение цвета для frame time
   */
  public static getFrameTimeColor(frameTime: number): string {
    // Инвертированные пороги для frame time (меньше = лучше)
    const invertedValue = Math.max(0, FRAME_TIME_INVERT_MAX - frameTime);
    const thresholds = { 
      good: FRAME_TIME_INVERT_MAX - PERFORMANCE_THRESHOLDS.FRAME_TIME.warning, 
      warning: FRAME_TIME_INVERT_MAX - PERFORMANCE_THRESHOLDS.FRAME_TIME.good 
    };
    return ColorUtils.getPerformanceColor(invertedValue, thresholds);
  }
}

// Утилиты для работы с памятью
export class MemoryUtils {
  /**
   * Получение информации о памяти браузера
   */
  public static getCurrentMemoryInfo(): MemoryInfo | undefined {
    if ('memory' in performance) {
      const memory = (performance as Record<string, unknown>)['memory'] as MemoryInfo;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return undefined;
  }

  /**
   * Расчет использования памяти в процентах
   */
  public static getMemoryUsagePercentage(memoryInfo: MemoryInfo): number {
    return (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  }

  /**
   * Определение тренда использования памяти
   */
  public static getMemoryTrend(history: MemoryInfo[]): 'increasing' | 'decreasing' | 'stable' {
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
}

// Утилиты для анализа производительности
export class AnalysisUtils {
  /**
   * Расчет скользящего среднего
   */
  public static calculateMovingAverage(values: number[], windowSize: number): number {
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
  }

  /**
   * Быстрый расчет медианы
   */
  public static quickMedian(values: number[]): number {
    if (values.length === 0) { return 0; }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const midVal = sorted[mid];
    const prevVal = sorted[mid - 1];

    if (midVal === undefined) return 0;

    return sorted.length % 2 === 0 && prevVal !== undefined
      ? (prevVal + midVal) / 2
      : midVal;
  }

  /**
   * Расчет стандартного отклонения
   */
  public static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) { return 0; }
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Определение стабильности производительности
   */
  public static getPerformanceStability(values: number[]): 'stable' | 'unstable' | 'critical' {
    if (values.length < STABILITY_MIN_VALUES) { return 'stable'; }

    const stdDev = AnalysisUtils.calculateStandardDeviation(values);
    const mean = AnalysisUtils.calculateMovingAverage(values, values.length);
    const coefficientOfVariation = (stdDev / mean) * 100;

    if (coefficientOfVariation > STABILITY_CRITICAL_THRESHOLD) { return 'critical'; }
    if (coefficientOfVariation > STABILITY_UNSTABLE_THRESHOLD) { return 'unstable'; }
    return 'stable';
  }
}

// Утилиты для времени
export class TimeUtils {
  /**
   * Получение текущего времени с высокой точностью
   */
  public static now(): number {
    return performance.now();
  }

  /**
   * Создание таймера с автоматической очисткой
   */
  public static createTimer(callback: () => void, interval: number): NodeJS.Timeout {
    return setInterval(callback, interval);
  }

  /**
   * Очистка таймера
   */
  public static clearTimer(timer: NodeJS.Timeout | null): void {
    if (timer) {
      clearInterval(timer);
    }
  }

  /**
   * Создание requestAnimationFrame с автоматической очисткой
   */
  public static requestAnimationFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  }

  /**
   * Очистка requestAnimationFrame
   */
  public static cancelAnimationFrame(frameId: number | null): void {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
  }
}

// Интерфейсы
export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceThresholds {
  good: number;
  warning: number;
}

// Комбинированные утилиты для удобства
export const PerformanceHelpers = {
  format: FormatUtils,
  color: ColorUtils,
  memory: MemoryUtils,
  analysis: AnalysisUtils,
  time: TimeUtils,
  thresholds: PERFORMANCE_THRESHOLDS
};
