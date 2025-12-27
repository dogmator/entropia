/**
 * Модульні тести для PerformanceMonitor.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  });

  it('повинен коректно розраховувати FPS', () => {
    monitor.beginFrame();
    monitor.endFrame(100, 10);

    const metrics = monitor.getCurrentMetrics();
    expect(metrics.fps).toBeGreaterThan(0);
  });

  it('повинен коректно розраховувати TPS', () => {
    monitor.registerTick(16.67); // 60 TPS
    const metrics = monitor.getCurrentMetrics();
    expect(metrics.tps).toBeGreaterThan(0);
  });

  it('повинен відстежувати продуктивність підсистем', () => {
    const endTimer = monitor.startSubsystemTimer('TestSystem');
    // Симулюємо роботу підсистеми
    for (let i = 0; i < 1000000; i++) { }
    endTimer();

    const metrics = monitor.getSubsystemMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0].name).toBe('TestSystem');
  });
});
