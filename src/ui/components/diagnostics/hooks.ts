import { useCallback, useEffect, useRef, useState } from 'react';

import { DIAGNOSTICS_CONFIG } from '@/constants';
import type { LogEntry } from '@/core/services/Logger';
import { logger } from '@/core/services/Logger';
import type { MemoryStats, PerformanceMetrics, SimulationStats, SystemMetrics } from '@/types';

export const useSystemMetrics = (
    isOpen: boolean,
    performanceHistory: PerformanceMetrics[],
    memoryStats: MemoryStats,
    currentStats: SimulationStats
) => {
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const collectSystemMetrics = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            const now = Date.now();
            const performance = performanceHistory[performanceHistory.length - 1];

            const newMetric: SystemMetrics = {
                timestamp: now,
                fps: performance?.fps || 0,
                tps: performance?.tps || 0,
                frameTime: performance?.frameTime || 0,
                simulationTime: performance?.simulationTime || 0,
                entityCount: currentStats.preyCount + currentStats.predatorCount,
                memoryUsage: memoryStats.usedJSHeapSize,
                drawCalls: performance?.drawCalls || 0,
                cpu: 0,
                memory: memoryStats.usedJSHeapSize || 0
            };

            setSystemMetrics(prev => {
                const updated = [...prev, newMetric];
                return updated.slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH);
            });
        });
    }, [performanceHistory, memoryStats, currentStats]);

    useEffect(() => {
        if (isOpen) {
            collectSystemMetrics();
            intervalRef.current = setInterval(collectSystemMetrics, DIAGNOSTICS_CONFIG.CHART.REFRESH_RATE);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setTimeout(() => setSystemMetrics([]), 0);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isOpen, collectSystemMetrics]);

    return systemMetrics;
};

export const useDetailedLogs = (isOpen: boolean) => {
    const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);
    const logsSubscriptionRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setDetailedLogs(logger.getLogs()), 0);

            logsSubscriptionRef.current = logger.subscribe((logs) => {
                setDetailedLogs(logs.slice(-DIAGNOSTICS_CONFIG.LOGS.MAX_ENTRIES));
            });

            logger.info('Diagnostics modal opened', 'UI', { timestamp: Date.now() });
        } else {
            if (logsSubscriptionRef.current) {
                logsSubscriptionRef.current();
                logsSubscriptionRef.current = null;
            }
        }

        return () => {
            if (logsSubscriptionRef.current) {
                logsSubscriptionRef.current();
                logsSubscriptionRef.current = null;
            }
        };
    }, [isOpen]);

    return detailedLogs;
};
