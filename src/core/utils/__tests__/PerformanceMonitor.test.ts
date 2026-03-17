/**
 * Модульні тести для PerformanceMonitor.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { PERFORMANCE_CONSTANTS } from '@/config';

import { PerformanceMonitor } from "../../services/PerformanceMonitor";

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it('повинен ініціалізуватися з дефолтними значеннями', () => {
    const metrics = monitor.getCurrentMetrics();
    expect(metrics.fps).toBe(60);
    expect(metrics.tps).toBe(60);
    expect(metrics.entityCount).toBe(0);
  });

  describe('Метрики кадрів (FPS)', () => {
    it('повинен реєструвати кадри та розраховувати FPS', () => {
      // Симулюємо декілька кадрів
      for (let i = 0; i < 5; i++) {
        monitor.beginFrame();
        monitor.endFrame(100, 10);
      }

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.fps).toBeGreaterThan(0);
      expect(metrics.entityCount).toBe(100);
      expect(metrics.drawCalls).toBe(10);
    });

    it('повинен зберігати історію FPS', () => {
      for (let i = 0; i < 10; i++) {
        monitor.beginFrame();
        monitor.endFrame(0);
      }

      const history = monitor.getFPSHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1]).toBeGreaterThan(0);
    });


    it('повинен зберігати історію кадрів у кільцевому буфері без втрати актуального запису', () => {
      const framesToRecord = PERFORMANCE_CONSTANTS.MAX_ENTRIES + 5;

      for (let i = 1; i <= framesToRecord; i++) {
        monitor.beginFrame();
        monitor.endFrame(i, i);
      }

      const history = monitor.getPerformanceHistory();
      expect(history).toHaveLength(PERFORMANCE_CONSTANTS.MAX_ENTRIES);
      expect(history[0]?.entityCount).toBe(6);
      expect(history[history.length - 1]?.entityCount).toBe(framesToRecord);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.entityCount).toBe(framesToRecord);
      expect(metrics.drawCalls).toBe(framesToRecord);
    });
  });

  describe('Метрики симуляції (TPS)', () => {
    it('повинен реєструвати тіки та розраховувати TPS', () => {
      // Спочатку треба створити запис (кадр), щоб registerTick мав що оновлювати
      monitor.beginFrame();
      monitor.endFrame(0);

      monitor.registerTick(16.67);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.tps).toBeGreaterThan(0);
      expect(metrics.simulationTime).toBe(16.67);
    });
  });

  describe('Метрики підсистем', () => {
    it('повинен відстежувати час виконання підсистем', () => {
      const endTimer = monitor.startSubsystemTimer('TestSystem');
      // Симулюємо роботу
      for (let i = 0; i < 100000; i++) { }
      endTimer();

      const metrics = monitor.getSubsystemMetrics();
      const testSystem = metrics.find(m => m.name === 'TestSystem');

      expect(testSystem).toBeDefined();
      expect(testSystem!.calls).toBe(1);
      expect(testSystem!.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Метрики пам\'яті', () => {
    it('повинен повертати статистику пам\'яті та тренди', () => {
      const stats = monitor.getMemoryStats();
      expect(stats).toBeDefined();
      expect(stats.trend).toBe('stable');
    });
  });

  describe('Аналіз проблем та звіти', () => {
    it('повинен виявляти проблеми продуктивності', () => {
      const issues = monitor.detectPerformanceIssues();
      expect(Array.isArray(issues)).toBe(true);
    });

    it('повинен генерувати повний звіт', () => {
      const report = monitor.exportStatistics();
      expect(report.timestamp).toBeLessThanOrEqual(Date.now());
      expect(report.current).toBeDefined();
      expect(report.subsystemMetrics).toBeDefined();
    });
  });

  describe('Управління станом', () => {
    it('повинен очищати дані при reset()', () => {
      monitor.beginFrame();
      monitor.endFrame(100);
      monitor.reset();

      const report = monitor.getPerformanceHistory();
      expect(report.length).toBe(0);
    });

    it('повинен дозволяти вмикати/вимикати моніторинг', () => {
      monitor.setMonitoringEnabled(false);
      expect(monitor.isMonitoringActive()).toBe(false);

      monitor.beginFrame();
      monitor.endFrame(200);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.entityCount).toBe(0); // Дані не повинні збиратися
    });
  });
});
