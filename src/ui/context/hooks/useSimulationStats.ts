import type { PopulationDataPoint, SimulationStats } from '@shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { INITIAL_SIMULATION_STATS, UI_CONFIG, UI_CONTROLS } from '@/config';
import { logger } from '@/core';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import type { RenderMetrics, RenderMetricsRecorder } from '../renderMetrics';
import { FIXED_PRECISION, RENDER_METRICS_REFRESH_MS } from '../simulation.constants';

/**
 * The performance block the UI shows. fps, frame time and draw calls are what the canvas measured. The ticks per second
 * and the entity count are what the engine reported.
 */
const mergeRenderMetrics = (stats: SimulationStats, render: RenderMetrics): SimulationStats => ({
    ...stats,
    performance: {
        fps: render.fps,
        tps: stats.performance?.tps ?? 0,
        frameTime: Number(render.frameTime.toFixed(FIXED_PRECISION)),
        simulationTime: stats.performance?.simulationTime ?? 0,
        // The engine's own count is only kept while its monitor is on, so the entities are counted from the population.
        entityCount: stats.preyCount + stats.predatorCount + stats.foodCount,
        drawCalls: render.drawCalls,
    },
});

const appendHistoryPoint = (
    historyRef: React.RefObject<PopulationDataPoint[]>,
    setHistory: React.Dispatch<React.SetStateAction<PopulationDataPoint[]>>,
    dataPoint: PopulationDataPoint
): void => {
    const history = historyRef.current;
    history.push(dataPoint);
    if (history.length > UI_CONFIG.historyLength) {
        history.splice(0, history.length - UI_CONFIG.historyLength);
    }
    setHistory(history.slice());
};

const getHistoryUpdateFrequency = (speed: number): number => {
    const normalizedSpeed = speed > 1 ? speed : 1;
    return Math.max(1, Math.floor(UI_CONFIG.updateFrequency / normalizedSpeed));
};

const shouldLogTickStats = (tickCounter: number): boolean => tickCounter % UI_CONTROLS.SERVER_LOG_INTERVAL === 0;

export const useSimulationStats = (
    engine: ISimulationEngine,
    speed: number,
    renderMetrics: RenderMetricsRecorder
): { stats: SimulationStats; history: PopulationDataPoint[]; resetHistory: () => void } => {
    const [stats, setStats] = useState<SimulationStats>({ ...INITIAL_SIMULATION_STATS });
    const [history, setHistory] = useState<PopulationDataPoint[]>([]);
    const historyRef = useRef<PopulationDataPoint[]>([]);

    useEffect(() => {
        let tickCounter = 0;
        const unsubscribe = engine.addEventListener((event) => {
            if (event.type !== 'TickUpdated') return;

            setStats(mergeRenderMetrics(event.stats, renderMetrics.snapshot()));
            tickCounter++;

            const updateFreq = getHistoryUpdateFrequency(speed);
            if (tickCounter % updateFreq === 0) {
                appendHistoryPoint(historyRef, setHistory, {
                    time: tickCounter,
                    prey: event.stats.preyCount,
                    pred: event.stats.predatorCount,
                });
            }

            if (shouldLogTickStats(tickCounter)) {
                logger.info('Stats', 'Engine', { tick: tickCounter, q: { prey: event.stats.preyCount, pred: event.stats.predatorCount } });
            }
        });

        return () => { unsubscribe(); };
    }, [engine, speed, renderMetrics]);

    // The canvas keeps drawing while the simulation is paused, so its numbers are refreshed on a timer and not only on ticks.
    useEffect(() => {
        const timer = setInterval(() => {
            setStats(prev => mergeRenderMetrics(prev, renderMetrics.snapshot()));
        }, RENDER_METRICS_REFRESH_MS);
        return () => { clearInterval(timer); };
    }, [renderMetrics]);

    const resetHistory = useCallback(() => {
        historyRef.current = [];
        setHistory([]);
    }, []);

    return { stats, history, resetHistory };
};
