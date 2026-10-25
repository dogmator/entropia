import { useCallback, useRef, useState } from 'react';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { SPEED_KEYS } from '../simulation.constants';
import type { SimulationSettings } from './useSimulationSettings';

interface LifecycleParams {
    engine: ISimulationEngine;
    settings: SimulationSettings;
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

/** Running while the speed is above zero. At zero, the world is stopped if the user stopped it, and paused otherwise. */
const stateOf = (speed: number, isStopped: boolean): SimulationLifecycle['simulationState'] => {
    if (speed > 0) return 'running';
    return isStopped ? 'stopped' : 'paused';
};

export const useSimulationLifecycle = (params: LifecycleParams): SimulationLifecycle => {
    const { engine, settings, resetHistory } = params;
    // A pause and a stop both have speed zero. The stop is kept as its own flag, and the state is derived from the speed and the
    // flag, so that a speed update can never overwrite the state that a stop set.
    const [isStopped, setIsStopped] = useState(false);
    const simulationState = stateOf(settings.speed, isStopped);
    const lastNonZeroSpeedRef = useRef(settings.speed > 0 ? settings.speed : SPEED_KEYS.NORMAL);

    const setSpeedWithState = useCallback((val: number | ((prev: number) => number)) => {
        // Any change of speed leaves a stop; the state follows from the new speed alone.
        setIsStopped(false);
        settings.setSpeed((prev) => {
            const next = typeof val === 'function' ? val(prev) : val;
            if (next > 0) lastNonZeroSpeedRef.current = next;
            return next;
        });
    }, [settings]);

    const runSimulation = useCallback(() => {
        const nextSpeed = lastNonZeroSpeedRef.current > 0 ? lastNonZeroSpeedRef.current : SPEED_KEYS.NORMAL;
        setSpeedWithState(nextSpeed);
    }, [setSpeedWithState]);

    const pauseSimulation = useCallback(() => {
        setSpeedWithState(SPEED_KEYS.PAUSE);
    }, [setSpeedWithState]);

    const stopSimulation = useCallback(() => {
        setSpeedWithState(SPEED_KEYS.PAUSE);
        // Set after the speed change, so that the stop is the last word on the state.
        setIsStopped(true);
        engine.pause();
    }, [engine, setSpeedWithState]);

    const onReset = useCallback(() => {
        // The reset answers with the new world's own snapshot, so the view is right whether or not the loop runs. The loop is
        // still stopped first, because a reset leaves the speed alone and a world that was running would go on running.
        engine.pause();
        engine.reset();
        resetHistory();
        setSpeedWithState(SPEED_KEYS.PAUSE);
    }, [engine, resetHistory, setSpeedWithState]);

    return { simulationState, setSpeedWithState, runSimulation, pauseSimulation, stopSimulation, onReset };
};
