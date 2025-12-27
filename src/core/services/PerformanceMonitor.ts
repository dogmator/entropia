/**
 * Performance Monitor — система сбора и анализа метрик продуктивности приложения.
 * 
 * Предоставляет детальную информацию о:
 * - Производительности рендеринга (FPS)
 * - Производительности симуляции (TPS) 
 * - Использовании памяти
 * - Загрузке CPU
 * - Временных характеристиках различных подсистем
 */

import type { PerformanceMetrics } from '../../types';
import type { MemoryInfo } from '../utils/PerformanceUtils';
import { PERFORMANCE_CONSTANTS } from '../../constants';
import { PerformanceHelpers } from '../utils/PerformanceUtils';
import { logger } from './Logger';

interface PerformanceEntry {
  timestamp: number;
  fps: number;
  tps: number;
  frameTime: number;
  simulationTime: number;
  entityCount: number;
  drawCalls: number;
  memoryUsage?: MemoryInfo;
}

interface SubsystemMetrics {
  name: string;
  executionTime: number;
  calls: number;
  averageTime: number;
  maxTime: number;
}

export class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private maxEntries: number = PERFORMANCE_CONSTANTS.MAX_ENTRIES;
  private frameCount: number = 0;
  private lastFPSUpdate: number = performance.now();
  private currentFPS: number = PERFORMANCE_CONSTANTS.DEFAULT_FPS;
  private lastTPSUpdate: number = performance.now();
  private currentTPS: number = PERFORMANCE_CONSTANTS.DEFAULT_TPS;
  private tickCount: number = 0;

  // Метрики підсистем
  private subsystemMetrics: Map<string, SubsystemMetrics> = new Map();
  private currentFrameStartTime: number = 0;

  // Історичні дані для аналізу трендів (кільцеві буфери)
  private fpsRingBuffer: number[] = new Array(PERFORMANCE_CONSTANTS.RING_BUFFER_SIZE).fill(PERFORMANCE_CONSTANTS.DEFAULT_FPS);
  private fpsRingIndex: number = 0;
  private memoryRingBuffer: (MemoryInfo | null)[] = new Array(PERFORMANCE_CONSTANTS.RING_BUFFER_SIZE).fill(null);
  private memoryRingIndex: number = 0;

  // Таймери для управління
  private fpsUpdateTimer: NodeJS.Timeout | null = null;
  private memoryTimer: NodeJS.Timeout | null = null;
  private isCollectingMemory: boolean = false;
  private memoryCollectionInterval: number = PERFORMANCE_CONSTANTS.MEMORY_COLLECTION_INTERVAL;
  private isMonitoringEnabled: boolean = true;
  private lastCleanupTime: number = 0;
  private cleanupInterval: number = PERFORMANCE_CONSTANTS.CLEANUP_INTERVAL;

  constructor() {
    logger.info('Initializing PerformanceMonitor', 'PerformanceMonitor');
    // Запускаем мониторинг производительности с минимальным влиянием
    this.startOptimizedMonitoring();
  }

  /**
   * Оптимизированный запуск мониторинга с минимальным влиянием
   */
  private startOptimizedMonitoring(): void {
    // Оновлення FPS кожні 500мс (рідше для зменшення навантаження)
    this.fpsUpdateTimer = PerformanceHelpers.time.createTimer(() => {
      if (this.isMonitoringEnabled) {
        this.updateFPS();
      }
    }, PERFORMANCE_CONSTANTS.FPS_UPDATE_INTERVAL);

    // Збір метрик пам'яті кожні 5 секунд (мінімальний вплив)
    this.memoryTimer = PerformanceHelpers.time.createTimer(() => {
      if (this.isMonitoringEnabled) {
        this.collectMemoryMetrics();
      }
    }, this.memoryCollectionInterval);
  }

  /**
   * Обновление счетчика FPS (оптимизированный)
   */
  private updateFPS(): void {
    const now = PerformanceHelpers.time.now();
    const delta = now - this.lastFPSUpdate;

    if (delta >= PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) {
      this.currentFPS = Math.round((this.frameCount * PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) / delta);
      this.frameCount = 0;
      this.lastFPSUpdate = now;

      // Оновлюємо кільцевий буфер
      this.fpsRingBuffer[this.fpsRingIndex] = this.currentFPS;
      this.fpsRingIndex = (this.fpsRingIndex + 1) % this.fpsRingBuffer.length;
    }
  }

  /**
   * Начало измерения кадра (минимальные операции)
   */
  public beginFrame(): void {
    if (!this.isMonitoringEnabled) { return; }
    this.currentFrameStartTime = PerformanceHelpers.time.now();
    this.frameCount++;
  }

  /**
   * Завершение измерения кадра (оптимизированное)
   */
  public endFrame(entityCount: number, drawCalls: number = 0): void {
    if (!this.isMonitoringEnabled || !this.currentFrameStartTime) { return; }

    const now = PerformanceHelpers.time.now();
    const frameTime = now - this.currentFrameStartTime;

    // Лимитируем количество записей для уменьшения нагрузки
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }

    const entry: PerformanceEntry = {
      timestamp: now,
      fps: this.currentFPS,
      tps: this.currentTPS,
      frameTime,
      simulationTime: 0, // Будет обновлено из Engine
      entityCount,
      drawCalls,
      memoryUsage: this.getCurrentMemoryInfo()
    };

    this.entries.push(entry);
  }

  /**
   * Регистрация тика симуляции (оптимизированная)
   */
  public registerTick(simulationTime: number): void {
    if (!this.isMonitoringEnabled) {
      this.tickCount++;
      return;
    }

    const now = PerformanceHelpers.time.now();
    const delta = now - this.lastTPSUpdate;

    if (delta >= PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) {
      this.currentTPS = Math.round((this.tickCount * PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) / delta);
      this.tickCount = 0;
      this.lastTPSUpdate = now;
    }

    // Оновлюємо останній запис
    if (this.entries.length > 0) {
      const lastEntry = this.entries[this.entries.length - 1];
      if (lastEntry) {
        lastEntry.simulationTime = simulationTime;
      }
    }

    this.tickCount++;
  }

  /**
   * Начало измерения производительности подсистемы (оптимизированное)
   */
  public startSubsystemTimer(name: string): () => void {
    if (!this.isMonitoringEnabled) {
      return () => { }; // No-op якщо моніторинг вимкнено
    }

    const startTime = PerformanceHelpers.time.now();

    return () => {
      const endTime = PerformanceHelpers.time.now();
      const executionTime = endTime - startTime;

      // Оновлюємо метрики тільки якщо час виконання значний
      if (executionTime > PERFORMANCE_CONSTANTS.MIN_EXECUTION_TIME) {
        const existing = this.subsystemMetrics.get(name);
        if (existing) {
          existing.calls++;
          existing.executionTime += executionTime;
          existing.averageTime = existing.executionTime / existing.calls;
          existing.maxTime = Math.max(existing.maxTime, executionTime);
        } else {
          this.subsystemMetrics.set(name, {
            name,
            executionTime,
            calls: 1,
            averageTime: executionTime,
            maxTime: executionTime
          });
        }
      }
    };
  }

  /**
   * Сбор метрик памяти (оптимизированный)
   */
  private collectMemoryMetrics(): void {
    if (this.isCollectingMemory) { return; }
    this.isCollectingMemory = true;

    const memoryInfo = this.getCurrentMemoryInfo();
    if (memoryInfo) {
      this.memoryRingBuffer[this.memoryRingIndex] = memoryInfo;
      this.memoryRingIndex = (this.memoryRingIndex + 1) % this.memoryRingBuffer.length;
    }

    this.isCollectingMemory = false;
  }

  /**
   * Получение текущей информации о памяти
   */
  private getCurrentMemoryInfo(): MemoryInfo | undefined {
    return PerformanceHelpers.memory.getCurrentMemoryInfo();
  }

  /**
   * Получение истории FPS (оптимизированное)
   */
  public getFPSHistory(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.fpsRingBuffer.length; i++) {
      const index = (this.fpsRingIndex + i) % this.fpsRingBuffer.length;
      const val = this.fpsRingBuffer[index];
      if (val !== undefined) {
        result.push(val);
      }
    }
    return result;
  }

  /**
   * Получение истории памяти (оптимизированное)
   */
  public getMemoryHistory(): MemoryInfo[] {
    const result: MemoryInfo[] = [];
    for (let i = 0; i < this.memoryRingBuffer.length; i++) {
      const index = (this.memoryRingIndex + i) % this.memoryRingBuffer.length;
      const memory = this.memoryRingBuffer[index];
      if (memory) { result.push(memory); }
    }
    return result;
  }

  /**
   * Включение/выключение мониторинга для минимизации влияния
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.isMonitoringEnabled = enabled;
  }

  /**
   * Проверка включен ли мониторинг
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoringEnabled;
  }

  /**
   * Автоматичне керування моніторингом для мінімізації впливу
   */
  private autoAdjustMonitoring(): void {
    const now = PerformanceHelpers.time.now();
    if (now - this.lastCleanupTime < this.cleanupInterval) { return; }

    this.lastCleanupTime = now;

    // Адаптивне керування моніторингом залежно від FPS
    const fps = this.getCurrentFPS();
    if (fps < PERFORMANCE_CONSTANTS.FPS_CRITICAL_LOW && this.isMonitoringEnabled) {
      // Критично низький FPS - вимикаємо моніторинг
      logger.warning('Critical low FPS detected, disabling monitoring', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_CRITICAL_LOW
      });
      this.setMonitoringEnabled(false);

      // Включаємо назад через 30 секунд
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
          logger.info('Monitoring re-enabled after performance recovery', 'PerformanceMonitor');
        }
      }, PERFORMANCE_CONSTANTS.RECOVERY_TIMEOUT);
    } else if (fps < PERFORMANCE_CONSTANTS.FPS_LOW && this.isMonitoringEnabled) {
      // Низький FPS - зменшуємо частоту оновлення
      this.setMonitoringEnabled(false);
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
        }
      }, PERFORMANCE_CONSTANTS.QUICK_RECOVERY_TIMEOUT);
    } else if (fps < PERFORMANCE_CONSTANTS.FPS_MEDIUM && this.isMonitoringEnabled) {
      // Низький FPS - зменшуємо частоту збору пам'яті
      this.memoryCollectionInterval = PERFORMANCE_CONSTANTS.SLOW_MEMORY_INTERVAL;
      logger.warning('Low FPS detected, reducing memory collection frequency', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_MEDIUM,
        newInterval: this.memoryCollectionInterval
      });
    } else if (fps > PERFORMANCE_CONSTANTS.FPS_GOOD && !this.isMonitoringEnabled) {
      // Хороша продуктивність - включаємо моніторинг
      this.setMonitoringEnabled(true);
      this.memoryCollectionInterval = PERFORMANCE_CONSTANTS.MEMORY_COLLECTION_INTERVAL;
      logger.info('Good FPS detected, enabling full monitoring', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_GOOD
      });
    }
  }

  /**
   * Отримання поточного FPS з кешуванням
   */
  private getCurrentFPS(): number {
    const now = PerformanceHelpers.time.now();
    if (now - this.lastFPSUpdate > PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) {
      this.currentFPS = this.calculateFPS();
      this.lastFPSUpdate = now;
    }
    return this.currentFPS;
  }

  /**
   * Розрахунок FPS з оптимізацією
   */
  private calculateFPS(): number {
    if (this.entries.length === 0) { return 0; }

    // Використовуємо останні записи для розрахунку
    const recentEntries = this.entries.slice(-PERFORMANCE_CONSTANTS.RECENT_ENTRIES_WINDOW);
    if (recentEntries.length === 0) { return 0; }

    const totalFrameTime = recentEntries.reduce((sum, entry) => sum + entry.frameTime, 0);
    const avgFrameTime = totalFrameTime / recentEntries.length;

    if (avgFrameTime === 0) { return 0; }

    const fps = PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD / avgFrameTime;

    return Math.min(Math.max(fps, PERFORMANCE_CONSTANTS.FPS_MIN), PERFORMANCE_CONSTANTS.FPS_MAX);
  }

  /**
   * Получение текущих метрик производительности (быстрое)
   */
  public getCurrentMetrics(): PerformanceMetrics {
    // Автоматическая настройка при каждом запросе
    this.autoAdjustMonitoring();

    const lastEntry = this.entries[this.entries.length - 1];

    return {
      fps: this.currentFPS,
      tps: this.currentTPS,
      frameTime: lastEntry?.frameTime || 0,
      simulationTime: lastEntry?.simulationTime || 0,
      entityCount: lastEntry?.entityCount || 0,
      drawCalls: lastEntry?.drawCalls || 0
    };
  }

  /**
   * Получение истории метрик
   */
  public getPerformanceHistory(): PerformanceMetrics[] {
    return this.entries.map(entry => ({
      fps: entry.fps,
      tps: entry.tps,
      frameTime: entry.frameTime,
      simulationTime: entry.simulationTime,
      entityCount: entry.entityCount,
      drawCalls: entry.drawCalls
    }));
  }

  /**
   * Получение метрик подсистем
   */
  public getSubsystemMetrics(): SubsystemMetrics[] {
    return Array.from(this.subsystemMetrics.values())
      .sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Получение статистики по памяти (оптимизированное)
   */
  public getMemoryStats(): MemoryInfo & { trend: 'increasing' | 'decreasing' | 'stable' } {
    const current = this.getCurrentMemoryInfo();
    if (!current) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        trend: 'stable'
      };
    }

    // Анализ тренда на основе кольцевого буфера
    const recent = this.getMemoryHistory().slice(-10);
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (recent.length >= PERFORMANCE_CONSTANTS.MIN_TREND_SAMPLES) {
      const first = recent[0]?.usedJSHeapSize;
      const last = recent[recent.length - 1]?.usedJSHeapSize;

      if (first !== undefined && last !== undefined) {
        const change = (last - first) / first;

        if (change > PERFORMANCE_CONSTANTS.MEMORY_TREND_THRESHOLD) { trend = 'increasing'; }
        else if (change < PERFORMANCE_CONSTANTS.MEMORY_TREND_NEG_THRESHOLD) { trend = 'decreasing'; }
      }
    }

    return { ...current, trend };
  }

  /**
   * Получение средней производительности за период
   */
  public getAveragePerformance(windowMs: number = PERFORMANCE_CONSTANTS.AVG_PERFORMANCE_WINDOW): PerformanceMetrics {
    const cutoffTime = PerformanceHelpers.time.now() - windowMs;
    const recentEntries = this.entries.filter(entry => entry.timestamp > cutoffTime);

    if (recentEntries.length === 0) {
      return this.getCurrentMetrics();
    }

    const avgEntry = recentEntries.reduce((acc, entry) => ({
      fps: acc.fps + entry.fps,
      tps: acc.tps + entry.tps,
      frameTime: acc.frameTime + entry.frameTime,
      simulationTime: acc.simulationTime + entry.simulationTime,
      entityCount: acc.entityCount + entry.entityCount,
      drawCalls: acc.drawCalls + entry.drawCalls
    }), { fps: 0, tps: 0, frameTime: 0, simulationTime: 0, entityCount: 0, drawCalls: 0 });

    const count = recentEntries.length;
    return {
      fps: avgEntry.fps / count,
      tps: avgEntry.tps / count,
      frameTime: avgEntry.frameTime / count,
      simulationTime: avgEntry.simulationTime / count,
      entityCount: Math.round(avgEntry.entityCount / count),
      drawCalls: Math.round(avgEntry.drawCalls / count)
    };
  }

  /**
   * Поиск проблем производительности
   */
  public detectPerformanceIssues(): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const current = this.getCurrentMetrics();
    // const avg = this.getAveragePerformance(10000); // За последние 10 секунд (unused)

    // Низький FPS
    if (current.fps < PERFORMANCE_CONSTANTS.FPS_MEDIUM) {
      issues.push({
        type: 'low_fps',
        severity: current.fps < PERFORMANCE_CONSTANTS.FPS_LOW ? 'critical' : 'warning',
        message: `Низький FPS: ${current.fps}`,
        suggestions: [
          'Зменшіть кількість сутностей',
          'Оптимізуйте налаштування графіки',
          'Перевірте завантаженість CPU'
        ]
      });
    }

    // Високий час кадру
    if (current.frameTime > PERFORMANCE_CONSTANTS.FRAME_TIME_WARNING) {
      issues.push({
        type: 'high_frame_time',
        severity: current.frameTime > PERFORMANCE_CONSTANTS.FRAME_TIME_CRITICAL ? 'critical' : 'warning',
        message: `Високий час кадру: ${current.frameTime.toFixed(1)}ms`,
        suggestions: [
          'Оптимизируйте логику рендеринга',
          'Уменьшите сложность шейдеров',
          'Проверьте количество draw calls'
        ]
      });
    }

    // Витік пам'яті
    const memoryStats = this.getMemoryStats();
    if (memoryStats.trend === 'increasing' && memoryStats.usedJSHeapSize > memoryStats.jsHeapSizeLimit * PERFORMANCE_CONSTANTS.MEMORY_LEAK_THRESHOLD) {
      issues.push({
        type: 'memory_leak',
        severity: 'critical',
        message: 'Обнаружена возможная утечка памяти',
        suggestions: [
          'Перезапустите приложение',
          'Проверьте подписки на события',
          'Освободите неиспользуемые ресурсы'
        ]
      });
    }

    // Повільна підсистема
    const slowSubsystems = this.getSubsystemMetrics().filter(s => s.averageTime > PERFORMANCE_CONSTANTS.SUBSYSTEM_SLOW_THRESHOLD);
    if (slowSubsystems.length > 0) {
      issues.push({
        type: 'slow_subsystem',
        severity: 'warning',
        message: `Медленные подсистемы: ${slowSubsystems.map(s => s.name).join(', ')}`,
        suggestions: [
          'Оптимизируйте алгоритмы',
          'Добавьте кэширование',
          'Используйте Web Workers'
        ]
      });
    }

    return issues;
  }

  /**
   * Экспорт статистики для анализа
   */
  public exportStatistics(): PerformanceReport {
    return {
      timestamp: Date.now(),
      current: this.getCurrentMetrics(),
      average: this.getAveragePerformance(),
      history: this.getPerformanceHistory(),
      subsystemMetrics: this.getSubsystemMetrics(),
      memoryStats: this.getMemoryStats(),
      issues: this.detectPerformanceIssues(),
      fpsHistory: this.getFPSHistory(),
      memoryHistory: this.getMemoryHistory()
    };
  }

  /**
   * Сброс статистики (оптимизированный)
   */
  public reset(): void {
    // Очищення таймерів
    PerformanceHelpers.time.clearTimer(this.fpsUpdateTimer);
    PerformanceHelpers.time.clearTimer(this.memoryTimer);
    this.fpsUpdateTimer = null;
    this.memoryTimer = null;

    this.entries = [];
    this.subsystemMetrics.clear();
    this.fpsRingBuffer.fill(PERFORMANCE_CONSTANTS.DEFAULT_FPS);
    this.fpsRingIndex = 0;
    this.memoryRingBuffer.fill(null);
    this.memoryRingIndex = 0;
    this.frameCount = 0;
    this.tickCount = 0;
  }
}

interface PerformanceIssue {
  type: 'low_fps' | 'high_frame_time' | 'memory_leak' | 'slow_subsystem';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestions: string[];
}

interface PerformanceReport {
  timestamp: number;
  current: PerformanceMetrics;
  average: PerformanceMetrics;
  history: PerformanceMetrics[];
  subsystemMetrics: SubsystemMetrics[];
  memoryStats: MemoryInfo & { trend: 'increasing' | 'decreasing' | 'stable' };
  issues: PerformanceIssue[];
  fpsHistory: number[];
  memoryHistory: MemoryInfo[];
}
