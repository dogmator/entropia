import { useCallback, useEffect, useState } from 'react';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import type { CameraSnapshot, UIConfig } from './simulationUrlState';
import { readUIFromUrl, syncUIToUrl } from './simulationUrlState';

export type { CameraSnapshot } from './simulationUrlState';

// ============================================================================
// Hook
// ============================================================================

export interface SimulationSettings {
    worldScale: number;
    setWorldScale: (val: number) => void;
    speed: number;
    setSpeed: (val: number | ((prev: number) => number)) => void;
    isAutoRotate: boolean;
    setAutoRotate: (val: boolean) => void;
    autoRotateSpeed: number;
    setAutoRotateSpeed: (val: number) => void;
    cameraSnapshot: CameraSnapshot | null;
    setCameraSnapshot: (val: CameraSnapshot | null) => void;
}

export const useSimulationSettings = (engine: ISimulationEngine): SimulationSettings => {
    const [{ speed, worldScale, autoRotate: isAutoRotate, autoRotateSpeed, cameraSnapshot }, setState] = useState<UIConfig>(() => readUIFromUrl(window.location.search));

    const setWorldScale = useCallback((val: number) => {
        setState(prev => ({ ...prev, worldScale: val }));
        engine.updateWorldScale(val);
    }, [engine]);

    const setSpeed = useCallback((val: number | ((prev: number) => number)) => {
        setState(prev => {
            const next = typeof val === 'function' ? val(prev.speed) : val;
            engine.setSpeed(next);
            return { ...prev, speed: next };
        });
    }, [engine]);

    const setAutoRotate = useCallback((val: boolean) => {
        setState(prev => ({ ...prev, autoRotate: val }));
    }, []);

    const setAutoRotateSpeed = useCallback((val: number) => {
        setState(prev => ({ ...prev, autoRotateSpeed: val }));
    }, []);

    const setCameraSnapshot = useCallback((val: CameraSnapshot | null) => {
        setState(prev => ({ ...prev, cameraSnapshot: val }));
    }, []);

    useEffect(() => {
        syncUIToUrl({ speed, worldScale, autoRotate: isAutoRotate, autoRotateSpeed, cameraSnapshot });
    }, [speed, worldScale, isAutoRotate, autoRotateSpeed, cameraSnapshot]);

    return {
        worldScale, setWorldScale,
        speed, setSpeed,
        isAutoRotate, setAutoRotate,
        autoRotateSpeed, setAutoRotateSpeed,
        cameraSnapshot, setCameraSnapshot,
    };
};
