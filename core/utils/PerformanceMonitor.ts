/**
 * Модуль моніторингу та профілювання продуктивності обчислювального конвеєра.
 *
 * Забезпечує вимірювання критичних метрик рендерингу в реальному часі
 * та автоматичну адаптацію якості графіки при деградації продуктивності.
 */

import { ADAPTIVE_QUALITY_CONFIG } from '../../ui/config/RenderConfig';

/**
 * Інтерфейс актуальних метрик продуктивності.
 */
export interface PerformanceMetrics {
  /** Поточна частота оновлення кадрів (Frames Per Second). */
  readonly fps: number;

  /** Середня тривалість рендерингу кадру (мілісекунди). */
  readonly avgFrameTime: number;

  /** Максимальна тривалість кадру за останню секунду (мс). */
  readonly maxFrameTime: number;

  /** Мінімальна тривалість кадру за останню секунду (мс). */
  readonly minFrameTime: number;

  /** Кількість кадрів, що перевищили цільовий час (16.67 мс для 60 FPS). */
  readonly droppedFrames: number;

  /** Ймовірність виявлення активності Garbage Collector (0-1). */
  readonly gcPressure: number;
}

/**
 * Клас для безперервного моніторингу продуктивності графічного конвеєра.
 */
export class PerformanceMonitor {
  private frameStartTime: number = 0;
  private frameTimeSamples: number[] = [];
  private lastFpsUpdate: number = 0;
  private frameCountSinceLastUpdate: number = 0;
  private currentFps: number = 60;
  private slowFrameCount: number = 0;
  private targetFrameTime: number;
  private criticalFrameTime: number;

  /**
   * @param onQualityDowngrade - Callback для оповіщення про необхідність зниження якості
   * @param sampleSize - Розмір вікна вимірювань для усереднення (за замовчуванням 60 кадрів)
   */
  constructor(
    private onQualityDowngrade?: () => void,
    private sampleSize: number = 60
  ) {
    this.targetFrameTime = 1000 / ADAPTIVE_QUALITY_CONFIG.targetFPS;
    this.criticalFrameTime = 1000 / ADAPTIVE_QUALITY_CONFIG.criticalFPS;
  }

  /**
   * Ініціалізує вимірювання нового кадру.
   * Викликається на початку RAF callback.
   */
  public startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * Завершує вимірювання кадру та актуалізує метрики.
   * Викликається в кінці RAF callback.
   */
  public endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;

    // Додаємо зразок до вікна вимірювань
    this.frameTimeSamples.push(frameTime);
    if (this.frameTimeSamples.length > this.sampleSize) {
      this.frameTimeSamples.shift();
    }

    this.frameCountSinceLastUpdate++;

    // Оновлення FPS щосекунди
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round(
        (this.frameCountSinceLastUpdate * 1000) / (now - this.lastFpsUpdate)
      );
      this.frameCountSinceLastUpdate = 0;
      this.lastFpsUpdate = now;
    }

    // Детекція повільних кадрів
    if (frameTime > this.criticalFrameTime) {
      this.slowFrameCount++;

      if (
        this.slowFrameCount >= ADAPTIVE_QUALITY_CONFIG.slowFrameThreshold &&
        this.onQualityDowngrade
      ) {
        this.onQualityDowngrade();
        this.slowFrameCount = 0; // Скидання лічильника після тригерування
      }
    } else {
      // Поступове зниження лічильника при нормалізації продуктивності
      this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
    }
  }

  /**
   * Повертає актуальні метрики продуктивності.
   */
  public getMetrics(): PerformanceMetrics {
    if (this.frameTimeSamples.length === 0) {
      return {
        fps: 60,
        avgFrameTime: 16.67,
        maxFrameTime: 16.67,
        minFrameTime: 16.67,
        droppedFrames: 0,
        gcPressure: 0,
      };
    }

    const avgFrameTime =
      this.frameTimeSamples.reduce((a, b) => a + b, 0) /
      this.frameTimeSamples.length;

    const maxFrameTime = Math.max(...this.frameTimeSamples);
    const minFrameTime = Math.min(...this.frameTimeSamples);

    const droppedFrames = this.frameTimeSamples.filter(
      (t) => t > this.targetFrameTime
    ).length;

    // Евристична детекція GC: аномально довгі кадри серед стабільних
    const gcPressure = this.detectGcPressure();

    return {
      fps: this.currentFps,
      avgFrameTime,
      maxFrameTime,
      minFrameTime,
      droppedFrames,
      gcPressure,
    };
  }

  /**
   * Евристичний алгоритм детекції активності Garbage Collector.
   * Виявляє аномальні стрибки тривалості кадру, що характерні для GC пауз.
   */
  private detectGcPressure(): number {
    if (this.frameTimeSamples.length < 10) return 0;

    const sorted = [...this.frameTimeSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];

    // Якщо 90-й процентиль > 2x медіани, ймовірна активність GC
    const ratio = p90 / median;
    return Math.min(Math.max((ratio - 1.5) / 1.5, 0), 1);
  }

  /**
   * Скидання всіх накопичених метрик.
   */
  public reset(): void {
    this.frameTimeSamples = [];
    this.slowFrameCount = 0;
    this.frameCountSinceLastUpdate = 0;
    this.currentFps = 60;
  }

  /**
   * Логування метрик у консоль (для діагностики).
   */
  public logMetrics(): void {
    const metrics = this.getMetrics();
    console.log('[PerformanceMonitor] Поточні метрики:', {
      FPS: metrics.fps,
      'Середній час кадру': `${metrics.avgFrameTime.toFixed(2)} мс`,
      'Максимальний час': `${metrics.maxFrameTime.toFixed(2)} мс`,
      'Пропущено кадрів': metrics.droppedFrames,
      'Тиск GC': `${(metrics.gcPressure * 100).toFixed(1)}%`,
    });
  }
}

/**
 * Декоратор для автоматичного профілювання асинхронних функцій.
 *
 * @param label - Назва операції для ідентифікації у логах
 * @param fn - Асинхронна функція для профілювання
 */
export async function profileAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    console.log(`[Profile] ${label}: ${duration.toFixed(2)} мс`);
  }
}

/**
 * Декоратор для профілювання синхронних функцій.
 *
 * @param label - Назва операції
 * @param fn - Синхронна функція для профілювання
 */
export function profile<T>(label: string, fn: () => T): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    console.log(`[Profile] ${label}: ${duration.toFixed(2)} мс`);
  }
}
