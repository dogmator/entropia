/**
 * Набір модульних тестів для класу PerformanceMonitor.
 *
 * Верифікує коректність вимірювання метрик продуктивності,
 * детекцію GC пауз та механізми адаптивної якості.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let qualityDowngradeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    qualityDowngradeSpy = vi.fn();
    monitor = new PerformanceMonitor(qualityDowngradeSpy, 10); // Малий sample size для тестів
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // БАЗОВІ ТЕСТИ ВИМІРЮВАННЯ
  // ========================================================================

  describe('Базове вимірювання кадрів', () => {
    it('має повертати дефолтні метрики при відсутності вимірювань', () => {
      const metrics = monitor.getMetrics();

      expect(metrics.fps).toBe(60);
      expect(metrics.avgFrameTime).toBe(16.67);
      expect(metrics.droppedFrames).toBe(0);
      expect(metrics.gcPressure).toBe(0);
    });

    it('має коректно вимірювати один кадр', () => {
      monitor.startFrame();

      // Симуляція затримки 10 мс
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Busy wait
      }

      monitor.endFrame();

      const metrics = monitor.getMetrics();
      expect(metrics.avgFrameTime).toBeGreaterThan(9);
      expect(metrics.avgFrameTime).toBeLessThan(15);
    });

    it('має накопичувати зразки у вікні вимірювань', () => {
      // Створюємо 5 кадрів
      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        // Без затримки (швидкий кадр)
        monitor.endFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.avgFrameTime).toBeLessThan(5);
    });
  });

  // ========================================================================
  // ТЕСТИ ДЕТЕКЦІЇ ПОВІЛЬНИХ КАДРІВ
  // ========================================================================

  describe('Детекція повільних кадрів', () => {
    it('має викликати callback зниження якості після порогу повільних кадрів', () => {
      // Симулюємо 10+ повільних кадрів (>33.33 мс для criticalFPS=30)
      for (let i = 0; i < 12; i++) {
        monitor.startFrame();
        const start = performance.now();
        while (performance.now() - start < 35) {
          // Busy wait для симуляції повільного кадру
        }
        monitor.endFrame();
      }

      expect(qualityDowngradeSpy).toHaveBeenCalled();
    });

    it('НЕ має викликати callback при нормальних кадрах', () => {
      // Симулюємо 20 швидких кадрів
      for (let i = 0; i < 20; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      expect(qualityDowngradeSpy).not.toHaveBeenCalled();
    });

    it('має скидати лічильник повільних кадрів після тригерування', () => {
      // Тригеримо callback
      for (let i = 0; i < 12; i++) {
        monitor.startFrame();
        const start = performance.now();
        while (performance.now() - start < 35) {
          // Повільний кадр
        }
        monitor.endFrame();
      }

      const firstCallCount = qualityDowngradeSpy.mock.calls.length;

      // Ще декілька повільних кадрів (менше порогу)
      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      // Callback не має бути викликаний знову
      expect(qualityDowngradeSpy.mock.calls.length).toBe(firstCallCount);
    });
  });

  // ========================================================================
  // ТЕСТИ ОБЧИСЛЕННЯ МЕТРИК
  // ========================================================================

  describe('Обчислення метрик', () => {
    it('має коректно вираховувати середній час кадру', () => {
      // Створюємо зразки з відомими значеннями
      // Використовуємо mock для performance.now()
      let time = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        time += 10; // Кожен виклик додає 10 мс
        return time;
      });

      monitor.startFrame();
      monitor.endFrame();

      const metrics = monitor.getMetrics();
      expect(metrics.avgFrameTime).toBeCloseTo(10, 1);

      vi.restoreAllMocks();
    });

    it('має визначати максимальний та мінімальний час кадру', () => {
      let time = 0;
      const frameTimes = [5, 10, 20, 8, 15];

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const result = time;
        time += frameTimes.shift() ?? 0;
        return result;
      });

      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.maxFrameTime).toBeCloseTo(20, 1);
      expect(metrics.minFrameTime).toBeCloseTo(5, 1);

      vi.restoreAllMocks();
    });

    it('має рахувати droppedFrames (кадри > targetFrameTime)', () => {
      // targetFrameTime = 1000/55 ≈ 18.18 мс
      let time = 0;
      const frameTimes = [10, 25, 30, 15, 20]; // 3 кадри > 18.18 мс

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const result = time;
        time += frameTimes.shift() ?? 0;
        return result;
      });

      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.droppedFrames).toBeGreaterThanOrEqual(2);

      vi.restoreAllMocks();
    });
  });

  // ========================================================================
  // ТЕСТИ ДЕТЕКЦІЇ GC PRESSURE
  // ========================================================================

  describe('Детекція GC pressure', () => {
    it('має детектувати високий тиск GC при аномальних стрибках', () => {
      let time = 0;
      // Більшість кадрів швидкі (10 мс), але є викид (50 мс) — характерно для GC
      const frameTimes = [10, 10, 10, 50, 10, 10, 10, 10, 10, 50];

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const result = time;
        time += frameTimes.shift() ?? 10;
        return result;
      });

      for (let i = 0; i < 10; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.gcPressure).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it('має повертати низький GC pressure для стабільних кадрів', () => {
      let time = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        const result = time;
        time += 16; // Стабільні 16 мс кадри
        return result;
      });

      for (let i = 0; i < 10; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.gcPressure).toBe(0);

      vi.restoreAllMocks();
    });
  });

  // ========================================================================
  // ТЕСТИ RESET() ТА ДОПОМІЖНИХ МЕТОДІВ
  // ========================================================================

  describe('Методи reset() та logMetrics()', () => {
    it('reset() має очистити всі накопичені дані', () => {
      // Створюємо декілька зразків
      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        monitor.endFrame();
      }

      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBe(60);
      expect(metrics.avgFrameTime).toBe(16.67);
      expect(metrics.droppedFrames).toBe(0);
    });

    it('logMetrics() не має викидати помилку', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      monitor.startFrame();
      monitor.endFrame();

      expect(() => monitor.logMetrics()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
