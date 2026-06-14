/**
 * Performance Monitor — a system for collecting and analyzing application performance metrics.
 * 
 * Provides detailed information about:
 * - Rendering performance (FPS)
 * - Simulation performance (TPS) 
 * - Memory usage
 * - CPU load
 * - Temporal characteristics of various subsystems
 */

import { PERFORMANCE_CONSTANTS } from '@/config';
import type { PerformanceMetrics } from '@/types';

import type { MemoryInfo} from '../utils/PerformanceUtils.utils';
import { PerformanceHelpers } from '../utils/PerformanceUtils.utils';
import { logger } from './Logger.service';

export type MemoryTrend = 'increasing' | 'decreasing' | 'stable';

export interface PerformanceIssue {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestions: string[];
}

export interface SubsystemMetrics {
  name: string;
  executionTime: number;
  calls: number;
  averageTime: number;
  maxTime: number;
}

export interface PerformanceReport {
  timestamp: number;
  current: PerformanceMetrics;
  average: PerformanceMetrics;
  history: PerformanceMetrics[];
  subsystemMetrics: SubsystemMetrics[];
  memoryStats: MemoryInfo & { trend: MemoryTrend };
  issues: PerformanceIssue[];
  fpsHistory: number[];
  memoryHistory: (MemoryInfo | null)[];
}

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

export class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private entriesStart = 0;
  private readonly maxEntries: number = PERFORMANCE_CONSTANTS.MAX_ENTRIES;
  private frameCount = 0;
  private lastFPSUpdate: number = performance.now();
  private currentFPS: number = PERFORMANCE_CONSTANTS.DEFAULT_FPS;
  private lastTPSUpdate: number = performance.now();
  private currentTPS: number = PERFORMANCE_CONSTANTS.DEFAULT_TPS;
  private tickCount = 0;

  // Subsystem metrics
  private readonly subsystemMetrics = new Map<string, SubsystemMetrics>();
  private currentFrameStartTime = 0;

  // Historical data for trend analysis (circular buffers)
  private fpsRingBuffer: number[] = (new Array(PERFORMANCE_CONSTANTS.RING_BUFFER_SIZE) as number[]).fill(PERFORMANCE_CONSTANTS.DEFAULT_FPS);
  private fpsRingIndex = 0;
  private memoryRingBuffer: (MemoryInfo | null)[] = (new Array(PERFORMANCE_CONSTANTS.RING_BUFFER_SIZE) as (MemoryInfo | null)[]).fill(null);
  private memoryRingIndex = 0;

  // Management timers
  private fpsUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private memoryTimer: ReturnType<typeof setInterval> | null = null;
  private isCollectingMemory = false;
  private memoryCollectionInterval: number = PERFORMANCE_CONSTANTS.MEMORY_COLLECTION_INTERVAL;
  private isMonitoringEnabled = true;
  private lastCleanupTime = 0;
  private readonly cleanupInterval: number = PERFORMANCE_CONSTANTS.CLEANUP_INTERVAL;

  constructor() {
    logger.info('Initializing PerformanceMonitor', 'PerformanceMonitor');
    // Start performance monitoring with minimal impact
    this.startOptimizedMonitoring();
  }

  /**
   * Optimized monitoring startup with minimal impact
   */
  private startOptimizedMonitoring(): void {
    // Update FPS every 500ms (less frequent to reduce load)
    this.fpsUpdateTimer = PerformanceHelpers.time.createTimer(() => {
      if (this.isMonitoringEnabled) {
        this.updateFPS();
      }
    }, PERFORMANCE_CONSTANTS.FPS_UPDATE_INTERVAL);

    // Collect memory metrics every 5 seconds (minimal impact)
    this.memoryTimer = PerformanceHelpers.time.createTimer(() => {
      if (this.isMonitoringEnabled) {
        this.collectMemoryMetrics();
      }
    }, this.memoryCollectionInterval);
  }

  /**
   * FPS counter update (optimized)
   */
  private updateFPS(): void {
    const now = PerformanceHelpers.time.now();
    const delta = now - this.lastFPSUpdate;

    if (delta >= PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) {
      this.currentFPS = Math.round((this.frameCount * PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD) / delta);
      this.frameCount = 0;
      this.lastFPSUpdate = now;

      // Update circular buffer
      this.fpsRingBuffer[this.fpsRingIndex] = this.currentFPS;
      this.fpsRingIndex = (this.fpsRingIndex + 1) % this.fpsRingBuffer.length;
    }
  }

  /**
   * Start frame measurement (minimal operations)
   */
  public beginFrame(): void {
    if (!this.isMonitoringEnabled) { return; }
    this.currentFrameStartTime = PerformanceHelpers.time.now();
    this.frameCount++;
  }

  /** Returns the timestamp recorded by the last {@link beginFrame} call. */
  public getFrameStartTime(): number {
    return this.currentFrameStartTime;
  }

  /**
   * Finish frame measurement (optimized)
   */
  public endFrame(entityCount: number, drawCalls = 0): void {
    if (!this.isMonitoringEnabled || !this.currentFrameStartTime) { return; }

    const now = PerformanceHelpers.time.now();
    const frameTime = now - this.currentFrameStartTime;

    const entry: PerformanceEntry = {
      timestamp: now,
      fps: this.currentFPS,
      tps: this.currentTPS,
      frameTime,
      simulationTime: 0, // Will be updated from Engine
      entityCount,
      drawCalls,
      memoryUsage: this.getCurrentMemoryInfo()
    };

    this.storeEntry(entry);
  }

  /**
   * Simulation tick registration (optimized)
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

    // Update latest entry
    const lastEntry = this.getLatestEntry();
    if (lastEntry) {
      lastEntry.simulationTime = simulationTime;
    }

    this.tickCount++;
  }

  /**
   * Start subsystem performance measurement (optimized)
   */
  public startSubsystemTimer(name: string): () => void {
    if (!this.isMonitoringEnabled) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => { }; // No-op if monitoring is disabled
    }

    const startTime = PerformanceHelpers.time.now();

    return () => {
      const endTime = PerformanceHelpers.time.now();
      const executionTime = endTime - startTime;

      // Update metrics only if execution time is significant
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
   * Memory metrics collection (optimized)
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
   * Get current memory information
   */
  private getCurrentMemoryInfo(): MemoryInfo | undefined {
    return PerformanceHelpers.memory.getCurrentMemoryInfo();
  }

  /**
   * Get FPS history (optimized)
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
   * Get memory history (optimized)
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
   * Enable/disable monitoring to minimize impact
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.isMonitoringEnabled = enabled;
  }

  /**
   * Check if monitoring is active
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoringEnabled;
  }

  /**
   * Automatic monitoring management to minimize impact
   */
  private autoAdjustMonitoring(): void {
    const now = PerformanceHelpers.time.now();
    if (now - this.lastCleanupTime < this.cleanupInterval) { return; }

    this.lastCleanupTime = now;

    // Adaptive monitoring control based on FPS
    const fps = this.getCurrentFPS();
    if (fps < PERFORMANCE_CONSTANTS.FPS_CRITICAL_LOW && this.isMonitoringEnabled) {
      // Critically low FPS - disable monitoring
      logger.warning('Critical low FPS detected, disabling monitoring', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_CRITICAL_LOW
      });
      this.setMonitoringEnabled(false);

      // Re-enable after 30 seconds
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
          logger.info('Monitoring re-enabled after performance recovery', 'PerformanceMonitor');
        }
      }, PERFORMANCE_CONSTANTS.RECOVERY_TIMEOUT);
    } else if (fps < PERFORMANCE_CONSTANTS.FPS_LOW && this.isMonitoringEnabled) {
      // Low FPS - reduce update frequency
      this.setMonitoringEnabled(false);
      setTimeout(() => {
        if (!this.isMonitoringEnabled) {
          this.setMonitoringEnabled(true);
        }
      }, PERFORMANCE_CONSTANTS.QUICK_RECOVERY_TIMEOUT);
    } else if (fps < PERFORMANCE_CONSTANTS.FPS_MEDIUM && this.isMonitoringEnabled) {
      // Low FPS - reduce memory collection frequency
      this.memoryCollectionInterval = PERFORMANCE_CONSTANTS.SLOW_MEMORY_INTERVAL;
      logger.warning('Low FPS detected, reducing memory collection frequency', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_MEDIUM,
        newInterval: this.memoryCollectionInterval
      });
    } else if (fps > PERFORMANCE_CONSTANTS.FPS_GOOD && !this.isMonitoringEnabled) {
      // Good performance - enable monitoring
      this.setMonitoringEnabled(true);
      this.memoryCollectionInterval = PERFORMANCE_CONSTANTS.MEMORY_COLLECTION_INTERVAL;
      logger.info('Good FPS detected, enabling full monitoring', 'PerformanceMonitor', {
        fps,
        threshold: PERFORMANCE_CONSTANTS.FPS_GOOD
      });
    }
  }

  /**
   * Get current FPS with caching
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
   * Calculate FPS with optimization
   */
  private calculateFPS(): number {
    const orderedEntries = this.getOrderedEntries();
    if (orderedEntries.length === 0) { return 0; }

    // Use latest entries for calculation
    const recentEntries = orderedEntries.slice(-PERFORMANCE_CONSTANTS.RECENT_ENTRIES_WINDOW);
    if (recentEntries.length === 0) { return 0; }

    const totalFrameTime = recentEntries.reduce((sum, entry) => sum + entry.frameTime, 0);
    const avgFrameTime = totalFrameTime / recentEntries.length;

    if (avgFrameTime === 0) { return 0; }

    const fps = PERFORMANCE_CONSTANTS.UPDATE_THRESHOLD / avgFrameTime;

    return Math.min(Math.max(fps, PERFORMANCE_CONSTANTS.FPS_MIN), PERFORMANCE_CONSTANTS.FPS_MAX);
  }

  /**
   * Get current performance metrics (fast)
   */
  public getCurrentMetrics(): PerformanceMetrics {
    // Automatic adjustment on every request
    this.autoAdjustMonitoring();

    const lastEntry = this.getLatestEntry();

    return {
      fps: this.currentFPS,
      tps: this.currentTPS,
      frameTime: lastEntry?.frameTime ?? 0,
      simulationTime: lastEntry?.simulationTime ?? 0,
      entityCount: lastEntry?.entityCount ?? 0,
      drawCalls: lastEntry?.drawCalls ?? 0
    };
  }

  /**
   * Get metrics history
   */
  public getPerformanceHistory(): PerformanceMetrics[] {
    return this.getOrderedEntries().map(entry => ({
      fps: entry.fps,
      tps: entry.tps,
      frameTime: entry.frameTime,
      simulationTime: entry.simulationTime,
      entityCount: entry.entityCount,
      drawCalls: entry.drawCalls
    }));
  }

  /**
   * Get subsystem metrics
   */
  public getSubsystemMetrics(): SubsystemMetrics[] {
    return Array.from(this.subsystemMetrics.values())
      .sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Get memory stats (optimized)
   */
  public getMemoryStats(): MemoryInfo & { trend: MemoryTrend } {
    const current = this.getCurrentMemoryInfo();
    if (!current) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        trend: 'stable'
      };
    }

    // Trend analysis based on circular buffer
    const recent = this.getMemoryHistory().slice(-PERFORMANCE_CONSTANTS.RECENT_ENTRIES_WINDOW);
    let trend: MemoryTrend = 'stable';

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
   * Get average performance over a period
   */
  public getAveragePerformance(windowMs: number = PERFORMANCE_CONSTANTS.AVG_PERFORMANCE_WINDOW): PerformanceMetrics {
    const cutoffTime = PerformanceHelpers.time.now() - windowMs;
    const recentEntries = this.getOrderedEntries().filter(entry => entry.timestamp > cutoffTime);

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
   * Detect performance issues
   */
  public detectPerformanceIssues(): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const current = this.getCurrentMetrics();

    this.detectFpsIssues(issues, current);
    this.detectFrameTimeIssues(issues, current);
    this.detectMemoryIssues(issues);
    this.detectSlowSubsystems(issues);

    return issues;
  }

  private detectFpsIssues(issues: PerformanceIssue[], current: PerformanceMetrics): void {
    if (current.fps < PERFORMANCE_CONSTANTS.FPS_MEDIUM) {
      issues.push({
        type: 'low_fps',
        severity: current.fps < PERFORMANCE_CONSTANTS.FPS_LOW ? 'critical' : 'warning',
        message: `Low FPS: ${String(current.fps)}`,
        suggestions: [
          'Reduce entity count',
          'Optimize graphics settings',
          'Check CPU load'
        ]
      });
    }
  }

  private detectFrameTimeIssues(issues: PerformanceIssue[], current: PerformanceMetrics): void {
    if (current.frameTime > PERFORMANCE_CONSTANTS.FRAME_TIME_WARNING) {
      issues.push({
        type: 'high_frame_time',
        severity: current.frameTime > PERFORMANCE_CONSTANTS.FRAME_TIME_CRITICAL ? 'critical' : 'warning',
        message: `High frame time: ${current.frameTime.toFixed(1)}ms`,
        suggestions: [
          'Optimize rendering logic',
          'Reduce shader complexity',
          'Check draw calls count'
        ]
      });
    }
  }

  private detectMemoryIssues(issues: PerformanceIssue[]): void {
    const memory = this.getMemoryStats();
    if (memory.trend === 'increasing') {
      issues.push({
        type: 'memory_leak',
        severity: 'warning',
        message: 'Tendency to increasing memory usage detected',
        suggestions: [
          'Check for memory leaks',
          'Clear unused resources',
          'Reduce object creation frequency'
        ]
      });
    }
  }

  private detectSlowSubsystems(issues: PerformanceIssue[]): void {
    const subsystems = this.getSubsystemMetrics();
    const slowOnes = subsystems.filter(s => s.averageTime > PERFORMANCE_CONSTANTS.SUBSYSTEM_SLOW_THRESHOLD);

    if (slowOnes.length > 0) {
      issues.push({
        type: 'slow_subsystem',
        severity: 'warning',
        message: `Slow subsystems: ${slowOnes.map(s => s.name).join(', ')}`,
        suggestions: [
          'Optimize logic of these subsystems',
          'Consider parallelizing calculations',
          'Check algorithm complexity'
        ]
      });
    }
  }

  /**
   * Export statistics for analysis
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
   * Reset statistics (optimized)
   */
  public reset(): void {
    // Clear timers
    PerformanceHelpers.time.clearTimer(this.fpsUpdateTimer);
    PerformanceHelpers.time.clearTimer(this.memoryTimer);
    this.fpsUpdateTimer = null;
    this.memoryTimer = null;

    this.entries = [];
    this.entriesStart = 0;
    this.subsystemMetrics.clear();
    this.fpsRingBuffer.fill(PERFORMANCE_CONSTANTS.DEFAULT_FPS);
    this.fpsRingIndex = 0;
    this.memoryRingBuffer.fill(null);
    this.memoryRingIndex = 0;
    this.frameCount = 0;
    this.tickCount = 0;
  }

  private storeEntry(entry: PerformanceEntry): void {
    if (this.entries.length < this.maxEntries) {
      this.entries.push(entry);
      return;
    }

    this.entries[this.entriesStart] = entry;
    this.entriesStart = (this.entriesStart + 1) % this.maxEntries;
  }

  private getLatestEntry(): PerformanceEntry | undefined {
    if (this.entries.length === 0) {
      return undefined;
    }

    if (this.entries.length < this.maxEntries) {
      return this.entries[this.entries.length - 1];
    }

    const latestIndex = (this.entriesStart + this.entries.length - 1) % this.entries.length;
    return this.entries[latestIndex];
  }

  private getOrderedEntries(): PerformanceEntry[] {
    if (this.entries.length < this.maxEntries || this.entriesStart === 0) {
      return this.entries;
    }

    return [
      ...this.entries.slice(this.entriesStart),
      ...this.entries.slice(0, this.entriesStart)
    ];
  }

}
