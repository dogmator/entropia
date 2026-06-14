import type { PropsWithChildren } from 'react';
import React, { createContext, useContext, useMemo } from 'react';

import { ENGINE_CONSTANTS } from '@/config';
import type { CameraState } from '@/shared/interfaces/CameraState';
import type { IEntityInfo } from '@/shared/interfaces/IEntityInfo';
import { EngineProxy } from '@/simulation/engine/EngineProxy';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { PopulationDataPoint, SimulationStats } from '@/types';

import { useEngineSync } from './hooks/useEngineSync';
import { useHotkeys } from './hooks/useHotkeys';
import { useHoverState } from './hooks/useHoverState';
import { useSimulationLifecycle } from './hooks/useSimulationLifecycle';
import type { CameraSnapshot } from './hooks/useSimulationSettings';
import { useSimulationSettings } from './hooks/useSimulationSettings';
import { useSimulationStats } from './hooks/useSimulationStats';

interface SimulationContextValue {
    engine: ISimulationEngine;
    stats: SimulationStats;
    history: PopulationDataPoint[];
    speed: number;
    setSpeed: (val: number | ((prev: number) => number)) => void;
    worldScale: number;
    setWorldScale: (val: number) => void;
    isLoading: boolean;
    onReset: () => void;
    cameraState: CameraState;
    setCameraState: (state: CameraState) => void;
    hoveredEntity: IEntityInfo | null;
    setHoveredEntity: (entity: IEntityInfo | null) => void;
    isTooltipVisible: boolean;
    tooltipPos: { x: number; y: number };
    setTooltipPos: (pos: { x: number; y: number }) => void;
    isAutoRotate: boolean;
    setAutoRotate: (val: boolean) => void;
    autoRotateSpeed: number;
    setAutoRotateSpeed: (val: number) => void;
    cameraSnapshot: CameraSnapshot | null;
    setCameraSnapshot: (val: CameraSnapshot | null) => void;
    simulationState: 'running' | 'paused' | 'stopped';
    runSimulation: () => void;
    pauseSimulation: () => void;
    stopSimulation: () => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSimulation = (): SimulationContextValue => {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error('useSimulation must be used within a SimulationProvider');
    }
    return context;
};

export const SimulationProvider = ({ children }: PropsWithChildren): React.JSX.Element => {
    const engine = useMemo(() => new EngineProxy({ tickRate: ENGINE_CONSTANTS.TICK_RATE }), []);
    const settings = useSimulationSettings(engine);
    const sync = useEngineSync(engine, settings.speed, settings.worldScale);
    const statsInfo = useSimulationStats(engine, settings.speed);
    const hover = useHoverState();
    const lifecycle = useSimulationLifecycle({
        engine,
        settings,
        sync,
        resetHistory: statsInfo.resetHistory
    });

    useHotkeys(lifecycle.setSpeedWithState);

    const value = useMemo(() => ({
        engine, stats: statsInfo.stats, history: statsInfo.history,
        speed: settings.speed, setSpeed: lifecycle.setSpeedWithState,
        worldScale: settings.worldScale, setWorldScale: settings.setWorldScale,
        isLoading: sync.isLoading, onReset: lifecycle.onReset,
        cameraState: sync.cameraState, setCameraState: sync.setCameraState,
        hoveredEntity: hover.hoveredEntity, setHoveredEntity: hover.setHoveredEntity,
        isTooltipVisible: hover.isTooltipVisible, tooltipPos: hover.tooltipPos, setTooltipPos: hover.setTooltipPos,
        isAutoRotate: settings.isAutoRotate, setAutoRotate: settings.setAutoRotate,
        autoRotateSpeed: settings.autoRotateSpeed, setAutoRotateSpeed: settings.setAutoRotateSpeed,
        cameraSnapshot: settings.cameraSnapshot, setCameraSnapshot: settings.setCameraSnapshot,
        simulationState: lifecycle.simulationState, runSimulation: lifecycle.runSimulation,
        pauseSimulation: lifecycle.pauseSimulation, stopSimulation: lifecycle.stopSimulation,
    }), [
        engine, statsInfo.stats, statsInfo.history, settings.speed, lifecycle,
        settings.worldScale, settings.setWorldScale, sync, hover, settings.isAutoRotate,
        settings.setAutoRotate, settings.autoRotateSpeed, settings.setAutoRotateSpeed,
        settings.cameraSnapshot, settings.setCameraSnapshot
    ]);

    return (
        <SimulationContext.Provider value={value}>
            {children}
        </SimulationContext.Provider>
    );
};
