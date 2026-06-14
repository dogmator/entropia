import type { PopulationDataPoint, SimulationStats } from '@shared/types';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { INITIAL_SIMULATION_STATS, UI_CONFIG, UI_CONTROLS } from '@/config';
import { logger } from '@/core';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { FIXED_PRECISION } from '../simulation.constants';
import { useFpsCalculator } from './useFpsCalculator';

const createStatsWithPerf = (engineStats: SimulationStats, frameTime: number, currentFps: number): SimulationStats => ({
    ...engineStats,
    performance: {
        fps: currentFps,
        tps: engineStats.performance?.tps ?? 0,
        frameTime: Number(frameTime.toFixed(FIXED_PRECISION)),
        simulationTime: engineStats.performance?.simulationTime ?? 0,
        entityCount: engineStats.performance?.entityCount ?? 0,
        drawCalls: engineStats.performance?.drawCalls ?? 0,
    }
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

export const useSimulationStats = (engine: ISimulationEngine, speed: number): { stats: SimulationStats; history: PopulationDataPoint[]; resetHistory: () => void } => {
    const [stats, setStats] = useState<SimulationStats>({ ...INITIAL_SIMULATION_STATS });
    const [history, setHistory] = useState<PopulationDataPoint[]>([]);
    const historyRef = useRef<PopulationDataPoint[]>([]);
    const frameTimestampRef = useRef(performance.now());
    const { updateFps } = useFpsCalculator();

    useEffect(() => {
        let tickCounter = 0;
        const unsubscribe = engine.addEventListener((event) => {
            if (event.type !== 'TickUpdated') return;

            const now = performance.now();
            const frameTime = now - frameTimestampRef.current;
            frameTimestampRef.current = now;

            const currentFps = updateFps();
            setStats(createStatsWithPerf(event.stats, frameTime, currentFps));
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
    }, [engine, speed, updateFps]);

    const resetHistory = useCallback(() => {
        historyRef.current = [];
        setHistory([]);
    }, []);

    return { stats, history, resetHistory };
};
