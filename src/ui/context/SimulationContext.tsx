/**
 * SimulationContext - Global state management for the simulation.
 *
 * Responsibilities:
 * - Engine lifecycle management (init, reset, destroy)
 * - Global state (speed, scale, camera, stats)
 * - Event handling (ticks, keyboard shortcuts)
 * - Persistence (localStorage)
 */
import type { PopulationDataPoint, SimulationStats } from '@shared/types';
import type { CameraState } from '@ui/hooks';
import type { PropsWithChildren } from 'react';
import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    CAMERA,
    ENGINE_CONSTANTS,
    INITIAL_SIMULATION_STATS,
    UI_CONFIG,
    UI_CONTROLS
} from '@/config';
import { logger } from '@/core';
import { EngineProxy, isFood } from '@/simulation';
import type { IEntityInfo, ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

interface SimulationContextValue {
    engine: ISimulationEngine;
    stats: SimulationStats;
    history: PopulationDataPoint[];
    speed: number;
    setSpeed: (val: number | ((prev: number) => number)) => void;
    onReset: () => void;
    worldScale: number;
    setWorldScale: (val: number) => void;
    isLoading: boolean;
    cameraState: CameraState;
    setCameraState: (state: CameraState) => void;
    hoveredEntity: IEntityInfo | null;
    setHoveredEntity: (entity: IEntityInfo | null) => void;
    tooltipVisible: boolean;
    tooltipPos: { x: number; y: number };
    setTooltipPos: (pos: { x: number; y: number }) => void;
    autoRotate: boolean;
    setAutoRotate: (val: boolean) => void;
    autoRotateSpeed: number;
    setAutoRotateSpeed: (val: number) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

/**
 * Utility to log hover events.
 */
const logHoverEvent = (entity: IEntityInfo, previousEntity: IEntityInfo | null) => {
    if (entity === previousEntity) return;

    const isFoodItem = isFood(entity);
    // Explicitly check for dead status if available on the object runtime
    const isDead = (entity as any).isDead === true;
    const source = isFoodItem ? 'Hover:Food' : (isDead ? 'Hover:DeadEntity' : 'Hover:Entity');

    console.debug(`[Hover] ${entity.type} ID: ${entity.id} (Dead: ${isDead})`);

    logger.info(`Hovered over ${entity.type} (ID: ${entity.id})`, source, {
        id: entity.id,
        type: entity.type,
        position: entity.position,
        isFood: isFoodItem,
        isDead
    });
};

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error('useSimulation must be used within a SimulationProvider');
    }
    return context;
};

export const SimulationProvider: React.FC<PropsWithChildren> = ({ children }) => {
    /** World scale coefficient (0.5x - 10.0x). */
    const [worldScale, setWorldScaleState] = useState<number>(UI_CONTROLS.WORLD_SCALE.DEFAULT);

    const setWorldScale = (val: number) => {
        logger.info(`UI: Set World Scale to ${val}`, 'SimulationContext');
        setWorldScaleState(val);
        engine.updateWorldScale(val);
    };

    /** Initialize and memoize engine proxy. */
    const engine = useMemo(() => new EngineProxy({ tickRate: ENGINE_CONSTANTS.TICK_RATE }), []);

    // Async worker initialization
    useEffect(() => {
        setIsLoading(true);
        engine.init(worldScale).then(() => {
            setIsLoading(false);
        }).catch(err => {
            console.error('Failed to init engine proxy', err);
            setIsLoading(false);
        });

        return () => {
            console.log('[SimulationContext] Cleaning up engine proxy');
            engine.destroy?.();
        };
    }, [engine]);

    /** Temporal simulation speed (0x - 5x). */
    /** Temporal simulation speed (0x - 5x). */
    /** Temporal simulation speed (0x - 5x). */
    const [speed, setSpeedState] = useState<number>(UI_CONTROLS.SPEED.DEFAULT);

    const setSpeed = (val: number | ((prev: number) => number)) => {
        setSpeedState(prev => {
            const newValue = typeof val === 'function' ? val(prev) : val;
            logger.info(`UI: Set Speed to ${newValue}`, 'SimulationContext');
            return newValue;
        });
    };

    /** Sync speed to engine (Pause/Resume). */
    useEffect(() => {
        if (speed === 0) {
            engine.pause();
            logger.info('Synced Speed: Pausing engine', 'SimulationContext');
        } else {
            engine.resume();
            logger.info(`Synced Speed: Resuming engine (speed ${speed})`, 'SimulationContext');
        }
    }, [speed, engine]);

    /** Camera Auto-rotation. */
    const [autoRotate, setAutoRotateState] = useState<boolean>(CAMERA.AUTO_ROTATE.ENABLED);
    const [autoRotateSpeed, setAutoRotateSpeedState] = useState<number>(CAMERA.AUTO_ROTATE.SPEED);

    const setAutoRotate = useCallback((val: boolean) => {
        logger.info(`UI: Set Auto Rotate to ${val}`, 'SimulationContext');
        setAutoRotateState(val);
    }, []);

    const setAutoRotateSpeed = useCallback((val: number) => {
        logger.info(`UI: Set Auto Rotate Speed to ${val}`, 'SimulationContext');
        setAutoRotateSpeedState(val);
    }, []);

    /** Real-time Camera State. */
    const [cameraState, setCameraState] = useState<CameraState>({ ...CAMERA.INITIAL_STATE });

    // 1. Subscribe to remote commands (e.g. reload)
    useEffect(() => {
        const unsubscribe = logger.subscribeToCommands((cmd) => {
            if (cmd.action === 'RELOAD') {
                logger.info('Remote reload command received', 'System');
                window.location.reload();
            }
        });
        return () => unsubscribe();
    }, []);

    // Sync camera state to engine
    const lastCameraStateRef = useRef<CameraState | null>(null);
    useEffect(() => {
        if (cameraState) {
            const lastState = lastCameraStateRef.current;
            const hasChanges = !lastState ||
                lastState.position.x !== cameraState.position.x ||
                lastState.position.y !== cameraState.position.y ||
                lastState.position.z !== cameraState.position.z ||
                lastState.target.x !== cameraState.target.x ||
                lastState.target.y !== cameraState.target.y ||
                lastState.target.z !== cameraState.target.z ||
                lastState.zoom !== cameraState.zoom ||
                lastState.distance !== cameraState.distance ||
                lastState.fov !== cameraState.fov ||
                lastState.aspect !== cameraState.aspect;

            if (hasChanges) {
                lastCameraStateRef.current = cameraState;
                engine.setCameraData(cameraState.position, cameraState.target);
            }
        }
    }, [cameraState, engine]);

    /** Aggregated simulation stats. */
    const [stats, setStats] = useState<SimulationStats>({ ...INITIAL_SIMULATION_STATS });

    /** Population history for charts. */
    const [history, setHistory] = useState<PopulationDataPoint[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    /** Hover state. */
    const [hoveredEntity, setHoveredEntityState] = useState<IEntityInfo | null>(null);
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    /** Wrapper for hover logging. */
    const setHoveredEntity = (entity: IEntityInfo | null) => {
        if (entity) {
            logHoverEvent(entity, hoveredEntity);
        }
        setHoveredEntityState(entity);
    };

    /** History ref to avoid re-renders. */
    const historyRef = useRef<PopulationDataPoint[]>([]);

    useEffect(() => {
        setTooltipVisible(!!hoveredEntity);
    }, [hoveredEntity]);

    /** Performance metrics. */
    const fpsCounter = useRef<{ frames: number; lastTime: number; fps: number }>({ frames: 0, lastTime: performance.now(), fps: ENGINE_CONSTANTS.TICK_RATE });
    const tpsCounter = useRef<{ ticks: number; lastTime: number; tps: number }>({ ticks: 0, lastTime: performance.now(), tps: ENGINE_CONSTANTS.TICK_RATE });
    const frameTimestampRef = useRef(performance.now());

    /** Deserialize User Settings from LocalStorage. */
    useEffect(() => {
        const savedSpeed = localStorage.getItem(UI_CONTROLS.SPEED.STORAGE_KEY);
        if (savedSpeed) {
            const parsedSpeed = parseFloat(savedSpeed);
            setSpeed(Math.max(UI_CONTROLS.SPEED.MIN, Math.min(UI_CONTROLS.SPEED.MAX, parsedSpeed)));
        }
        const savedScale = localStorage.getItem(UI_CONTROLS.WORLD_SCALE.STORAGE_KEY);
        if (savedScale) {
            const parsedScale = parseFloat(savedScale);
            setWorldScale(Math.max(UI_CONTROLS.WORLD_SCALE.MIN, Math.min(UI_CONTROLS.WORLD_SCALE.MAX, parsedScale)));
        }
        const savedAutoRotate = localStorage.getItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_ENABLED);
        if (savedAutoRotate) {
            setAutoRotate(savedAutoRotate === 'true');
        }
        const savedRotateSpeed = localStorage.getItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_SPEED);
        if (savedRotateSpeed) {
            const parsedRotateSpeed = parseFloat(savedRotateSpeed);
            setAutoRotateSpeed(Math.max(CAMERA.AUTO_ROTATE.SPEED_MIN, Math.min(CAMERA.AUTO_ROTATE.SPEED_MAX, parsedRotateSpeed)));
        }

        // Simulate loader latency
        const timer = setTimeout(() => setIsLoading(false), UI_CONTROLS.LOADING_DELAY);
        return () => clearTimeout(timer);
    }, []);

    /** Persist Settings. */
    useEffect(() => {
        localStorage.setItem(UI_CONTROLS.SPEED.STORAGE_KEY, speed.toString());
        localStorage.setItem(UI_CONTROLS.WORLD_SCALE.STORAGE_KEY, worldScale.toString());
        localStorage.setItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_ENABLED, autoRotate.toString());
        localStorage.setItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_SPEED, autoRotateSpeed.toString());
    }, [speed, worldScale, autoRotate, autoRotateSpeed]);

    /** Subscribe to engine events. */
    useEffect(() => {
        let tickCounter = 0;
        const unsubscribe = engine.addEventListener((event) => {
            if (event.type === 'TickUpdated') {
                const now = performance.now();
                fpsCounter.current.frames++;
                tpsCounter.current.ticks++;

                const elapsedFps = now - fpsCounter.current.lastTime;
                const elapsedTps = now - tpsCounter.current.lastTime;

                // FPS Calc
                if (elapsedFps >= 1000) {
                    fpsCounter.current.fps = Math.round((fpsCounter.current.frames * 1000) / elapsedFps);
                    fpsCounter.current.frames = 0;
                    fpsCounter.current.lastTime = now;
                }

                // TPS Calc
                if (elapsedTps >= 1000) {
                    tpsCounter.current.tps = Math.round((tpsCounter.current.ticks * 1000) / elapsedTps);
                    tpsCounter.current.ticks = 0;
                    tpsCounter.current.lastTime = now;
                }

                const frameTime = now - frameTimestampRef.current;
                frameTimestampRef.current = now;

                const engineStats = engine.getStatsWithWorldData();

                const statsWithPerformance: SimulationStats = {
                    ...engineStats,
                    performance: engineStats.performance || {
                        fps: fpsCounter.current.fps,
                        tps: tpsCounter.current.tps,
                        frameTime: Number(frameTime.toFixed(2)),
                        simulationTime: Number((event.deltaTime * 1000).toFixed(2)),
                        entityCount: event.stats.preyCount + event.stats.predatorCount + event.stats.foodCount,
                        drawCalls: 5,
                    }
                };

                setStats(statsWithPerformance);

                tickCounter++;
                // Update History
                if (tickCounter % Math.max(1, Math.floor(UI_CONFIG.updateFrequency / (speed > 1 ? speed : 1))) === 0) {
                    const newData: PopulationDataPoint = {
                        time: tickCounter,
                        prey: event.stats.preyCount,
                        pred: event.stats.predatorCount
                    };
                    historyRef.current = [...historyRef.current, newData].slice(-UI_CONFIG.historyLength);
                    setHistory([...historyRef.current]);
                }

                // Log statistical events
                if (tickCounter % UI_CONTROLS.SERVER_LOG_INTERVAL === 0) {
                    logger.info('Simulation Stats', 'Engine', {
                        tick: tickCounter,
                        entities: {
                            prey: event.stats.preyCount,
                            predator: event.stats.predatorCount,
                            food: event.stats.foodCount
                        },
                        performance: {
                            fps: fpsCounter.current.fps,
                            tps: tpsCounter.current.tps
                        }
                    });
                }
            }
        });

        // Global hotkeys
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Space') {
                setSpeed(prev => prev === 0 ? 1 : 0);
            } else if (e.key === '0') {
                setSpeed(0);
            } else if (e.key === '1') {
                setSpeed(1);
            } else if (e.key === '2') {
                setSpeed(2);
            } else if (e.key === '5') {
                setSpeed(5);
            }

            if (['f', 'F', 'а', 'А'].includes(e.key)) {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('keydown', handleKey);
            unsubscribe();
        };
    }, [engine, speed]);

    const onReset = () => {
        logger.info('UI: Reset Simulation requested', 'SimulationContext');
        localStorage.clear();
        engine.reset();
        historyRef.current = [];
        setHistory([]);
    };

    const value = {
        engine,
        stats,
        history,
        speed,
        setSpeed,
        worldScale,
        setWorldScale,
        isLoading,
        onReset,
        cameraState,
        setCameraState,
        hoveredEntity,
        setHoveredEntity,
        tooltipVisible,
        tooltipPos,
        setTooltipPos,
        autoRotate,
        setAutoRotate,
        autoRotateSpeed,
        setAutoRotateSpeed,
    };

    return (
        <SimulationContext.Provider value={value}>
            {children}
        </SimulationContext.Provider>
    );
};
