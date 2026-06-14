import { useCallback, useEffect, useRef, useState } from 'react';

import { UI_CONTROLS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { SPEED_KEYS } from '../simulation.constants';
import type { SimulationSettings } from './useSimulationSettings';

interface LifecycleParams {
    engine: ISimulationEngine;
    settings: SimulationSettings;
    sync: { setIsLoading: (v: boolean) => void };
    resetHistory: () => void;
}

export interface SimulationLifecycle {
    simulationState: 'running' | 'paused' | 'stopped';
    setSpeedWithState: (val: number | ((prev: number) => number)) => void;
    runSimulation: () => void;
    pauseSimulation: () => void;
    stopSimulation: () => void;
    onReset: () => void;
}

export const useSimulationLifecycle = (params: LifecycleParams): SimulationLifecycle => {
    const { engine, settings, sync, resetHistory } = params;
    const [simulationState, setSimulationState] = useState<'running' | 'paused' | 'stopped'>(
        settings.speed > 0 ? 'running' : 'paused'
    );
    const lastNonZeroSpeedRef = useRef(settings.speed > 0 ? settings.speed : SPEED_KEYS.NORMAL);

    const setSpeedWithState = useCallback((val: number | ((prev: number) => number)) => {
        settings.setSpeed((prev) => {
            const next = typeof val === 'function' ? val(prev) : val;
            if (next > 0) {
                lastNonZeroSpeedRef.current = next;
                setSimulationState('running');
            } else { setSimulationState('paused'); }
            return next;
        });
    }, [settings]);

    useEffect(() => {
        const timer = setTimeout(() => { sync.setIsLoading(false); }, UI_CONTROLS.LOADING_DELAY);
        return () => { clearTimeout(timer); };
    }, [sync]);

    const runSimulation = useCallback(() => {
        const nextSpeed = lastNonZeroSpeedRef.current > 0 ? lastNonZeroSpeedRef.current : SPEED_KEYS.NORMAL;
        setSpeedWithState(nextSpeed);
        setSimulationState('running');
    }, [setSpeedWithState]);

    const pauseSimulation = useCallback(() => {
        setSpeedWithState(SPEED_KEYS.PAUSE);
        setSimulationState('paused');
    }, [setSpeedWithState]);

    const stopSimulation = useCallback(() => {
        setSpeedWithState(SPEED_KEYS.PAUSE);
        engine.pause();
        setSimulationState('stopped');
    }, [engine, setSpeedWithState]);

    const onReset = useCallback(() => {
        localStorage.clear();
        engine.reset();
        resetHistory();
        setSimulationState('paused');
    }, [engine, resetHistory]);

    return { simulationState, setSpeedWithState, runSimulation, pauseSimulation, stopSimulation, onReset };
};
