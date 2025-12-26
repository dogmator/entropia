/**
 * Performance Utils - утилиты для работы с метриками производительности
 * Устраняет нарушения DRY в системе мониторинга
 */

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
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Форматирование времени в миллисекундах
   */
  static formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Форматирование процентов
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
}

// Утилиты для цветовой индикации
export class ColorUtils {
  /**
   * Получение цвета на основе порогов производительности
   */
  static getPerformanceColor(value: number, thresholds: { good: number; warning: number }): string {
    if (value >= thresholds.good) return 'text-emerald-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  }

  /**
   * Получение цвета для использования памяти
   */
  static getMemoryColor(usage: number): string {
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.good) return 'text-emerald-400';
    if (usage < PERFORMANCE_THRESHOLDS.MEMORY_USAGE.warning) return 'text-yellow-400';
    return 'text-red-400';
  }

  /**
   * Получение цвета для FPS
   */
  static getFPSColor(fps: number): string {
    return ColorUtils.getPerformanceColor(fps, PERFORMANCE_THRESHOLDS.FPS);
  }

  /**
   * Получение цвета для TPS
   */
  static getTPSColor(tps: number): string {
    return ColorUtils.getPerformanceColor(tps, PERFORMANCE_THRESHOLDS.TPS);
  }

  /**
   * Получение цвета для frame time
   */
  static getFrameTimeColor(frameTime: number): string {
    // Инвертированные пороги для frame time (меньше = лучше)
    const invertedValue = Math.max(0, 100 - frameTime);
    const thresholds = { good: 100 - PERFORMANCE_THRESHOLDS.FRAME_TIME.warning, warning: 100 - PERFORMANCE_THRESHOLDS.FRAME_TIME.good };
    return ColorUtils.getPerformanceColor(invertedValue, thresholds);
  }
}

// Утилиты для работы с памятью
export class MemoryUtils {
  /**
   * Получение информации о памяти браузера
   */
  static getCurrentMemoryInfo(): MemoryInfo | undefined {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
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
  static getMemoryUsagePercentage(memoryInfo: MemoryInfo): number {
    return (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  }

  /**
   * Определение тренда использования памяти
   */
  static getMemoryTrend(history: MemoryInfo[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 3) return 'stable';
    
    const recent = history.slice(-10);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    const change = (last - first) / first;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }
}

// Утилиты для анализа производительности
export class AnalysisUtils {
  /**
   * Расчет скользящего среднего
   */
  static calculateMovingAverage(values: number[], windowSize: number): number {
    if (values.length === 0) return 0;
    const start = Math.max(0, values.length - windowSize);
    let sum = 0;
    for (let i = start; i < values.length; i++) {
      sum += values[i];
    }
    return sum / (values.length - start);
  }

  /**
   * Быстрый расчет медианы
   */
  static quickMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Расчет стандартного отклонения
   */
  static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Определение стабильности производительности
   */
  static getPerformanceStability(values: number[]): 'stable' | 'unstable' | 'critical' {
    if (values.length < 10) return 'stable';
    
    const stdDev = AnalysisUtils.calculateStandardDeviation(values);
    const mean = AnalysisUtils.calculateMovingAverage(values, values.length);
    const coefficientOfVariation = (stdDev / mean) * 100;
    
    if (coefficientOfVariation > 20) return 'critical';
    if (coefficientOfVariation > 10) return 'unstable';
    return 'stable';
  }
}

// Утилиты для времени
export class TimeUtils {
  /**
   * Получение текущего времени с высокой точностью
   */
  static now(): number {
    return performance.now();
  }

  /**
   * Создание таймера с автоматической очисткой
   */
  static createTimer(callback: () => void, interval: number): NodeJS.Timeout {
    return setInterval(callback, interval);
  }

  /**
   * Очистка таймера
   */
  static clearTimer(timer: NodeJS.Timeout | null): void {
    if (timer) {
      clearInterval(timer);
    }
  }

  /**
   * Создание requestAnimationFrame с автоматической очисткой
   */
  static requestAnimationFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  }

  /**
   * Очистка requestAnimationFrame
   */
  static cancelAnimationFrame(frameId: number | null): void {
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
