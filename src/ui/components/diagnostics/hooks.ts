import { useEffect, useRef, useState } from 'react';

import { DIAGNOSTICS_CONFIG } from '@/config';
import type { LogEntry } from '@/core/services/Logger.service';
import { logger } from '@/core/services/Logger.service';
import type { MemoryStats, PerformanceMetrics, SimulationStats, SystemMetrics } from '@/types';

interface SystemMetricsOptions {
    isOpen: boolean;
    performanceHistory: PerformanceMetrics[];
    memoryStats: MemoryStats | null;
    currentStats: SimulationStats;
}

// What a metric shows before the canvas or the engine has reported anything.
const NO_RENDER_METRICS = { fps: 0, frameTime: 0, drawCalls: 0 };
const NO_ENGINE_METRICS = { tps: 0, simulationTime: 0 };

const mapStatsToMetric = (
    p: PerformanceMetrics | undefined,
    mem: number,
    stats: SimulationStats
): SystemMetrics => {
    // fps, frame time and draw calls are measured by the canvas and reach the stats; the history carries the engine's values.
    const render = stats.performance ?? NO_RENDER_METRICS;
    const engine = p ?? NO_ENGINE_METRICS;
    return {
        timestamp: Date.now(),
        fps: render.fps, tps: stats.performance?.tps ?? engine.tps,
        frameTime: render.frameTime, simulationTime: stats.performance?.simulationTime ?? engine.simulationTime,
        entityCount: stats.preyCount + stats.predatorCount,
        memoryUsage: mem, drawCalls: render.drawCalls, cpu: 0, memory: mem
    };
};

export const useSystemMetrics = ({
    isOpen,
    performanceHistory,
    memoryStats,
    currentStats
}: SystemMetricsOptions): SystemMetrics[] => {
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
    // Sample cadence must not reset every time the fast-changing simulation stats arrive.
    const latestRef = useRef({ performanceHistory, memoryStats, currentStats });

    useEffect(() => {
        latestRef.current = { performanceHistory, memoryStats, currentStats };
    }, [performanceHistory, memoryStats, currentStats]);

    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => { setSystemMetrics([]); }, 0);
            return () => { clearTimeout(timer); };
        }

        const timer = setInterval(() => {
            const latest = latestRef.current;
            const history = latest.performanceHistory;
            const metric = mapStatsToMetric(history[history.length - 1], latest.memoryStats?.usedJSHeapSize ?? 0, latest.currentStats);
            setSystemMetrics(prev => [...prev, metric].slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH));
        }, DIAGNOSTICS_CONFIG.CHART.REFRESH_RATE);

        return () => { clearInterval(timer); };
    }, [isOpen]);

    return systemMetrics;
};

export const useDetailedLogs = (isOpen: boolean): LogEntry[] => {
    const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);
    const logsSubscriptionRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => { setDetailedLogs(logger.getLogs()); }, 0);

            logsSubscriptionRef.current = logger.subscribe((logs) => {
                setDetailedLogs(logs.slice(-DIAGNOSTICS_CONFIG.LOGS.MAX_ENTRIES));
            });

            logger.info('Diagnostics modal opened', 'UI', { timestamp: Date.now() });

            return () => {
                clearTimeout(timer);
                if (logsSubscriptionRef.current) {
                    logsSubscriptionRef.current();
                    logsSubscriptionRef.current = null;
                }
            };
        }
        return undefined;
    }, [isOpen]);

    return detailedLogs;
};
