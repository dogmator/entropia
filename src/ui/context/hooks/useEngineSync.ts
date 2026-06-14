import { useEffect, useRef, useState } from 'react';

import { CAMERA } from '@/config';
import { logger } from '@/core';
import type { CameraState } from '@/shared/interfaces/CameraState';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

const isCameraDiff = (last: CameraState, curr: CameraState): boolean => {
    const isP = last.position.x !== curr.position.x || last.position.y !== curr.position.y || last.position.z !== curr.position.z;
    const isT = last.target.x !== curr.target.x || last.target.y !== curr.target.y || last.target.z !== curr.target.z;
    const isO = last.zoom !== curr.zoom || last.distance !== curr.distance || last.fov !== curr.fov || last.aspect !== curr.aspect;
    return isP || isT || isO;
};

export interface EngineSync {
    isLoading: boolean;
    setIsLoading: (val: boolean) => void;
    cameraState: CameraState;
    setCameraState: (state: CameraState) => void;
}

export const useEngineSync = (engine: ISimulationEngine, speed: number, worldScale: number): EngineSync => {
    const [isLoading, setIsLoading] = useState(true);
    const [cameraState, setCameraState] = useState<CameraState>({ ...CAMERA.INITIAL_STATE });
    const lastCameraStateRef = useRef<CameraState | null>(null);

    useEffect(() => {
        engine.init(worldScale)
            .then(() => { setIsLoading(false); })
            .catch((err: unknown) => {
                logger.error('Failed to init engine', 'SimulationContext', { err });
                setIsLoading(false);
            });

        return () => engine.destroy?.();
    }, [engine, worldScale]);

    useEffect(() => {
        engine.setSpeed(speed);
        if (speed === 0) {
            engine.pause();
        } else {
            engine.resume();
        }
    }, [speed, engine]);

    useEffect(() => {
        const last = lastCameraStateRef.current;
        if (!last || isCameraDiff(last, cameraState)) {
            lastCameraStateRef.current = cameraState;
            engine.setCameraData(cameraState.position, cameraState.target);
        }
    }, [cameraState, engine]);

    useEffect(() => {
        const unsubscribe = logger.subscribeToCommands((cmd) => {
            if (cmd['action'] === 'RELOAD') {
                window.location.reload();
            }
        });
        return () => { unsubscribe(); };
    }, []);

    return { isLoading, setIsLoading, cameraState, setCameraState };
};
