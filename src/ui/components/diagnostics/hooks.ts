import { useCallback, useEffect, useRef, useState } from 'react';

import { DIAGNOSTICS_CONFIG } from '@/config';
import type { LogEntry } from '@/core/services/Logger';
import { logger } from '@/core/services/Logger';
import type { MemoryStats, PerformanceMetrics, SimulationStats, SystemMetrics } from '@/types';

interface SystemMetricsOptions {
    isOpen: boolean;
    performanceHistory: PerformanceMetrics[];
    memoryStats: MemoryStats;
    currentStats: SimulationStats;
}

const mapStatsToMetric = (
    p: PerformanceMetrics | undefined,
    mem: number,
    stats: SimulationStats
): SystemMetrics => {
    if (!p) {
        return {
            timestamp: Date.now(),
            fps: 0, tps: 0, frameTime: 0, simulationTime: 0,
            entityCount: stats.preyCount + stats.predatorCount,
            memoryUsage: mem, drawCalls: 0, cpu: 0, memory: mem
        };
    }
    return {
        timestamp: Date.now(),
        fps: p.fps, tps: p.tps, frameTime: p.frameTime, simulationTime: p.simulationTime,
        entityCount: stats.preyCount + stats.predatorCount,
        memoryUsage: mem, drawCalls: p.drawCalls, cpu: 0, memory: mem
    };
};

export const useSystemMetrics = ({
    isOpen,
    performanceHistory,
    memoryStats,
    currentStats
}: SystemMetricsOptions) => {
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const getNewMetric = useCallback((): SystemMetrics => {
        const p = performanceHistory[performanceHistory.length - 1];
        const mem = memoryStats.usedJSHeapSize;
        return mapStatsToMetric(p, mem, currentStats);
    }, [performanceHistory, memoryStats, currentStats]);

    useEffect(() => {
        if (!isOpen) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            const timer = setTimeout(() => setSystemMetrics([]), 0);
            return () => clearTimeout(timer);
        }

        intervalRef.current = setInterval(() => {
            const newMetric = getNewMetric();
            setSystemMetrics(prev => [...prev, newMetric].slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH));
        }, DIAGNOSTICS_CONFIG.CHART.REFRESH_RATE);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isOpen, getNewMetric]);

    return systemMetrics;
};

export const useDetailedLogs = (isOpen: boolean) => {
    const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);
    const logsSubscriptionRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setDetailedLogs(logger.getLogs()), 0);

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
