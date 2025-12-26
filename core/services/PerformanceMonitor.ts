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

import { PerformanceMetrics } from '../../types';
import { PerformanceHelpers } from '../utils/PerformanceUtils';
import type { MemoryInfo } from '../utils/PerformanceUtils';
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
  private maxEntries: number = 300; // Храним 5 минут при частоте 1 Гц
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  private lastFPSUpdate: number = performance.now();
  private currentFPS: number = 60;
  private lastTPSUpdate: number = performance.now();
  private currentTPS: number = 60;
  private tickCount: number = 0;
  
  // Метрики подсистем
  private subsystemMetrics: Map<string, SubsystemMetrics> = new Map();
  private currentFrameStartTime: number = 0;
  
  // Исторические данные для анализа трендов (кольцевые буферы)
  private fpsRingBuffer: number[] = new Array(60).fill(60);
  private fpsRingIndex: number = 0;
  private memoryRingBuffer: MemoryInfo[] = new Array(60).fill(null);
  private memoryRingIndex: number = 0;
  
  // Таймеры для управления
  private fpsUpdateTimer: NodeJS.Timeout | null = null;
  private memoryTimer: NodeJS.Timeout | null = null;
  private isCollectingMemory: boolean = false;
  private memoryCollectionInterval: number = 5000; // 5 секунд для минимизации влияния
  private isMonitoringEnabled: boolean = true;
  private lastCleanupTime: number = 0;
  private cleanupInterval: number = 30000; // 30 секунд
  
  constructor() {
    logger.info('Initializing PerformanceMonitor', 'PerformanceMonitor');
    // Запускаем мониторинг производительности с минимальным влиянием
    this.startOptimizedMonitoring();
  }

  /**
   * Оптимизированный запуск мониторинга с минимальным влиянием
   */
  private startOptimizedMonitoring(): void {
    // Обновление FPS каждые 500мс (реже для уменьшения нагрузки)
    this.fpsUpdateTimer = PerformanceHelpers.time.createTimer(() => {
      if (this.isMonitoringEnabled) {
        this.updateFPS();
      }
    }, 500);

    // Сбор метрик памяти каждые 5 секунд (минимальное влияние)
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
    
    if (delta >= 1000) {
      this.currentFPS = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastFPSUpdate = now;
      
      // Обновляем кольцевой буфер
      this.fpsRingBuffer[this.fpsRingIndex] = this.currentFPS;
      this.fpsRingIndex = (this.fpsRingIndex + 1) % this.fpsRingBuffer.length;
    }
  }

  /**
   * Начало измерения кадра (минимальные операции)
   */
  public beginFrame(): void {
    if (!this.isMonitoringEnabled) return;
    this.currentFrameStartTime = PerformanceHelpers.time.now();
    this.frameCount++;
  }

  /**
   * Завершение измерения кадра (оптимизированное)
   */
  public endFrame(entityCount: number, drawCalls: number = 0): void {
    if (!this.isMonitoringEnabled || !this.currentFrameStartTime) return;
    
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
    
    if (delta >= 1000) {
      this.currentTPS = Math.round((this.tickCount * 1000) / delta);
      this.tickCount = 0;
      this.lastTPSUpdate = now;
    }
    
    // Обновляем последнюю запись
    if (this.entries.length > 0) {
      const lastEntry = this.entries[this.entries.length - 1];
      lastEntry.simulationTime = simulationTime;
    }
    
    this.tickCount++;
  }

  /**
   * Начало измерения производительности подсистемы (оптимизированное)
   */
  public startSubsystemTimer(name: string): () => void {
    if (!this.isMonitoringEnabled) {
      return () => {}; // No-op если мониторинг отключен
    }
    
    const startTime = PerformanceHelpers.time.now();
    
    return () => {
      const endTime = PerformanceHelpers.time.now();
      const executionTime = endTime - startTime;
      
      // Обновляем метрики только если время выполнения значительное
      if (executionTime > 0.1) {
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
    if (this.isCollectingMemory) return;
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
      result.push(this.fpsRingBuffer[index]);
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
      if (memory) result.push(memory);
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
    if (now - this.lastCleanupTime < this.cleanupInterval) return;
    
    this.lastCleanupTime = now;
    
    // Адаптивне керування моніторингом залежно від FPS
    const fps = this.getCurrentFPS();
    if (fps < 10 && this.isMonitoringEnabled) {
      // Критично низький FPS - вимикаємо моніторинг
      logger.warning('Critical low FPS detected, disabling monitoring', 'PerformanceMonitor', { 
        fps,
        threshold: 10 
      });
      this.setMonitoringEnabled(false);
      
      // Включаємо назад через 30 секунд (зменшено з 60)
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
          logger.info('Monitoring re-enabled after performance recovery', 'PerformanceMonitor');
        }
      }, 30000);
    } else if (fps < 15 && this.isMonitoringEnabled) {
      // Низький FPS - зменшуємо частоту оновлення
      this.setMonitoringEnabled(false);
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
        }
      }, 5000); // Включаємо через 5 секунд
    } else if (fps < 30 && this.isMonitoringEnabled) {
      // Низький FPS - зменшуємо частоту збору пам'яті
      this.memoryCollectionInterval = 10000; // 10 секунд
      logger.warning('Low FPS detected, reducing memory collection frequency', 'PerformanceMonitor', { 
        fps,
        threshold: 30,
        newInterval: this.memoryCollectionInterval
      });
    } else if (fps > 50 && !this.isMonitoringEnabled) {
      // Хороша продуктивність - включаємо моніторинг
      this.setMonitoringEnabled(true);
      this.memoryCollectionInterval = 5000; // 5 секунд
      logger.info('Good FPS detected, enabling full monitoring', 'PerformanceMonitor', { 
        fps,
        threshold: 50
      });
    }
  }

  /**
   * Отримання поточного FPS з кешуванням
   */
  private getCurrentFPS(): number {
    const now = PerformanceHelpers.time.now();
    if (now - this.lastFPSUpdate > 1000) { // Оновлюємо раз на секунду
      this.currentFPS = this.calculateFPS();
      this.lastFPSUpdate = now;
    }
    return this.currentFPS;
  }

  /**
   * Розрахунок FPS з оптимізацією
   */
  private calculateFPS(): number {
    if (this.entries.length === 0) return 0;
    
    // Використовуємо останні записи для розрахунку
    const recentEntries = this.entries.slice(-10); // Останні 10 записів
    if (recentEntries.length === 0) return 0;
    
    const totalFrameTime = recentEntries.reduce((sum, entry) => sum + entry.frameTime, 0);
    const avgFrameTime = totalFrameTime / recentEntries.length;
    
    if (avgFrameTime === 0) return 0;
    
    const fps = 1000 / avgFrameTime;
    
    return Math.min(Math.max(fps, 0), 999); // Обмежуємо діапазон
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
    
    if (recent.length >= 3) {
      const first = recent[0].usedJSHeapSize;
      const last = recent[recent.length - 1].usedJSHeapSize;
      const change = (last - first) / first;
      
      if (change > 0.05) trend = 'increasing';
      else if (change < -0.05) trend = 'decreasing';
    }

    return { ...current, trend };
  }

  /**
   * Получение средней производительности за период
   */
  public getAveragePerformance(windowMs: number = 60000): PerformanceMetrics {
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
    const avg = this.getAveragePerformance(10000); // За последние 10 секунд

    // Низкий FPS
    if (current.fps < 30) {
      issues.push({
        type: 'low_fps',
        severity: current.fps < 15 ? 'critical' : 'warning',
        message: `Низкий FPS: ${current.fps}`,
        suggestions: [
          'Уменьшите количество сущностей',
          'Оптимизируйте настройки графики',
          'Проверьте загрузку CPU'
        ]
      });
    }

    // Высокое время кадра
    if (current.frameTime > 20) {
      issues.push({
        type: 'high_frame_time',
        severity: current.frameTime > 33 ? 'critical' : 'warning',
        message: `Высокое время кадра: ${current.frameTime.toFixed(1)}ms`,
        suggestions: [
          'Оптимизируйте логику рендеринга',
          'Уменьшите сложность шейдеров',
          'Проверьте количество draw calls'
        ]
      });
    }

    // Утечка памяти
    const memoryStats = this.getMemoryStats();
    if (memoryStats.trend === 'increasing' && memoryStats.usedJSHeapSize > memoryStats.jsHeapSizeLimit * 0.8) {
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

    // Медленная подсистема
    const slowSubsystems = this.getSubsystemMetrics().filter(s => s.averageTime > 5);
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
    this.fpsRingBuffer.fill(60);
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

/**
 * Утилиты для оптимизации производительности
 */
export class PerformanceUtils {
  /**
   * Ленивое вычисление скользящего среднего
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
}
