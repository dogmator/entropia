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
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const FIXED_PRECISION = 2;
const MS_PER_SECOND = 1000;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Utility to log hover events.
 */
const logHoverEvent = (entity: IEntityInfo, previousEntity: IEntityInfo | null) => {
    if (entity === previousEntity) return;

    const isFoodItem = isFood(entity);
    // Explicitly check for dead status if available on the object runtime
    const isDead = 'isDead' in entity && (entity as { isDead?: boolean }).isDead === true;

    let source: string;
    if (isFoodItem) {
        source = 'Hover:Food';
    } else if (isDead) {
        source = 'Hover:DeadEntity';
    } else {
        source = 'Hover:Entity';
    }

    console.debug(`[Hover] ${entity.type} ID: ${entity.id} (Dead: ${isDead})`);

    logger.info(`Hovered over ${entity.type} (ID: ${entity.id})`, source, {
        id: entity.id,
        type: entity.type,
        position: entity.position,
        isFood: isFoodItem,
        isDead
    });
};

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

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error('useSimulation must be used within a SimulationProvider');
    }
    return context;
};

const isCameraDiff = (last: CameraState, curr: CameraState) => {
    const isP = last.position.x !== curr.position.x || last.position.y !== curr.position.y || last.position.z !== curr.position.z;
    const isT = last.target.x !== curr.target.x || last.target.y !== curr.target.y || last.target.z !== curr.target.z;
    const isO = last.zoom !== curr.zoom || last.distance !== curr.distance || last.fov !== curr.fov || last.aspect !== curr.aspect;
    return isP || isT || isO;
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Hook for managing simulation settings and their persistence.
 */
const useSimulationSettings = (engine: ISimulationEngine) => {
    const [worldScale, setWorldScaleState] = useState<number>(() => {
        const saved = localStorage.getItem(UI_CONTROLS.WORLD_SCALE.STORAGE_KEY);
        if (saved) {
            const parsed = parseFloat(saved);
            return Math.max(UI_CONTROLS.WORLD_SCALE.MIN, Math.min(UI_CONTROLS.WORLD_SCALE.MAX, parsed));
        }
        return UI_CONTROLS.WORLD_SCALE.DEFAULT;
    });

    const [speed, setSpeedState] = useState<number>(() => {
        const saved = localStorage.getItem(UI_CONTROLS.SPEED.STORAGE_KEY);
        if (saved) {
            const parsed = parseFloat(saved);
            return Math.max(UI_CONTROLS.SPEED.MIN, Math.min(UI_CONTROLS.SPEED.MAX, parsed));
        }
        return UI_CONTROLS.SPEED.DEFAULT;
    });

    const [autoRotate, setAutoRotateState] = useState<boolean>(() => {
        const saved = localStorage.getItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_ENABLED);
        return saved ? saved === 'true' : CAMERA.AUTO_ROTATE.ENABLED;
    });

    const [autoRotateSpeed, setAutoRotateSpeedState] = useState<number>(() => {
        const saved = localStorage.getItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_SPEED);
        if (saved) {
            const parsed = parseFloat(saved);
            return Math.max(CAMERA.AUTO_ROTATE.SPEED_MIN, Math.min(CAMERA.AUTO_ROTATE.SPEED_MAX, parsed));
        }
        return CAMERA.AUTO_ROTATE.SPEED;
    });

    const setWorldScale = useCallback((val: number) => {
        setWorldScaleState(val);
        engine.updateWorldScale(val);
    }, [engine]);

    const setSpeed = useCallback((val: number | ((prev: number) => number)) => {
        setSpeedState(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            engine.setSpeed(next);
            return next;
        });
    }, [engine]);

    const setAutoRotate = useCallback((val: boolean) => setAutoRotateState(val), []);
    const setAutoRotateSpeed = useCallback((val: number) => setAutoRotateSpeedState(val), []);

    // Persistence
    useEffect(() => {
        localStorage.setItem(UI_CONTROLS.SPEED.STORAGE_KEY, speed.toString());
        localStorage.setItem(UI_CONTROLS.WORLD_SCALE.STORAGE_KEY, worldScale.toString());
        localStorage.setItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_ENABLED, autoRotate.toString());
        localStorage.setItem(UI_CONTROLS.AUTO_ROTATE.STORAGE_KEY_SPEED, autoRotateSpeed.toString());
    }, [speed, worldScale, autoRotate, autoRotateSpeed]);

    return {
        worldScale, setWorldScale, speed, setSpeed,
        autoRotate, setAutoRotate, autoRotateSpeed, setAutoRotateSpeed
    };
};

/**
 * Hook for managing engine lifecycle and state synchronization.
 */
const useEngineSync = (engine: ISimulationEngine, speed: number, worldScale: number) => {
    const [isLoading, setIsLoading] = useState(true);
    const [cameraState, setCameraState] = useState<CameraState>({ ...CAMERA.INITIAL_STATE });
    const lastCameraStateRef = useRef<CameraState | null>(null);

    // Engine Init
    useEffect(() => {
        engine.init(worldScale)
            .then(() => setIsLoading(false))
            .catch((err: unknown) => {
                logger.error('Failed to init engine', 'SimulationContext', { err });
                setIsLoading(false);
            });

        return () => engine.destroy?.();
    }, [engine, worldScale]);

    // Speed & Loop Sync
    useEffect(() => {
        engine.setSpeed(speed);
        if (speed === 0) {
            engine.pause();
        } else {
            engine.resume();
        }
    }, [speed, engine]);

    // Camera Sync
    useEffect(() => {
        if (!cameraState) return;
        const last = lastCameraStateRef.current;
        if (!last || isCameraDiff(last, cameraState)) {
            lastCameraStateRef.current = cameraState;
            engine.setCameraData(cameraState.position, cameraState.target);
        }
    }, [cameraState, engine]);

    // Remote Commands
    useEffect(() => {
        const unsubscribe = logger.subscribeToCommands((cmd) => {
            if (cmd.action === 'RELOAD') {
                window.location.reload();
            }
        });
        return () => unsubscribe();
    }, []);

    return { isLoading, setIsLoading, cameraState, setCameraState };
};


const useFpsCalculator = () => {
    const fpsRef = useRef({ frames: 0, lastUpdate: performance.now(), current: 0 });

    const updateFps = useCallback(() => {
        const now = performance.now();
        fpsRef.current.frames++;
        if (now - fpsRef.current.lastUpdate >= MS_PER_SECOND) {
            fpsRef.current.current = Math.round((fpsRef.current.frames * MS_PER_SECOND) / (now - fpsRef.current.lastUpdate));
            fpsRef.current.frames = 0;
            fpsRef.current.lastUpdate = now;
        }
        return fpsRef.current.current;
    }, []);

    return { updateFps, currentFps: fpsRef.current.current };
};

/**
 * Hook for managing simulation stats and history.
 */
const useSimulationStats = (engine: ISimulationEngine, speed: number) => {
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

            const engineStats = event.stats;
            const statsWithPerf: SimulationStats = {
                ...engineStats,
                performance: {
                    fps: currentFps,
                    tps: engineStats.performance?.tps || 0,
                    frameTime: Number(frameTime.toFixed(FIXED_PRECISION)),
                    simulationTime: engineStats.performance?.simulationTime || 0,
                    entityCount: engineStats.performance?.entityCount || 0,
                    drawCalls: engineStats.performance?.drawCalls || 0,
                }
            };

            setStats(statsWithPerf);
            tickCounter++;

            const updateFreq = Math.max(1, Math.floor(UI_CONFIG.updateFrequency / (speed > 1 ? speed : 1)));
            if (tickCounter % updateFreq === 0) {
                const newData = { time: tickCounter, prey: event.stats.preyCount, pred: event.stats.predatorCount };
                historyRef.current = [...historyRef.current, newData].slice(-UI_CONFIG.historyLength);
                setHistory([...historyRef.current]);
            }

            if (tickCounter % UI_CONTROLS.SERVER_LOG_INTERVAL === 0) {
                logger.info('Stats', 'Engine', { tick: tickCounter, q: { prey: event.stats.preyCount, pred: event.stats.predatorCount } });
            }
        });

        return () => unsubscribe();
    }, [engine, speed]);

    const resetHistory = useCallback(() => {
        historyRef.current = [];
        setHistory([]);
    }, []);

    return { stats, history, resetHistory };
};

/**
 * Hook for managing hover and tooltip state.
 */
const useHoverState = () => {
    const [hoveredEntity, setHoveredEntityState] = useState<IEntityInfo | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const setHoveredEntity = useCallback((entity: IEntityInfo | null) => {
        if (entity) logHoverEvent(entity, hoveredEntity);
        setHoveredEntityState(entity);
    }, [hoveredEntity]);

    const tooltipVisible = !!hoveredEntity;

    return {
        hoveredEntity,
        setHoveredEntity,
        tooltipVisible,
        tooltipPos,
        setTooltipPos
    };
};

/**
 * Hook for managing global hotkeys.
 */
const SPEED_KEYS = {
    PAUSE: 0,
    NORMAL: 1,
    FAST: 2,
    TURBO: 5,
} as const;

/**
 * Hook for managing global hotkeys.
 */
const useHotkeys = (setSpeed: (val: number | ((prev: number) => number)) => void) => {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Space') {
                setSpeed(prev => prev === SPEED_KEYS.PAUSE ? SPEED_KEYS.NORMAL : SPEED_KEYS.PAUSE);
            } else if (e.key === '0') {
                setSpeed(SPEED_KEYS.PAUSE);
            } else if (e.key === '1') {
                setSpeed(SPEED_KEYS.NORMAL);
            } else if (e.key === '2') {
                setSpeed(SPEED_KEYS.FAST);
            } else if (e.key === '5') {
                setSpeed(SPEED_KEYS.TURBO);
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
        return () => window.removeEventListener('keydown', handleKey);
    }, [setSpeed]);
};

// ============================================================================
// PROVIDER
// ============================================================================

export const SimulationProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const engine = useMemo(() => new EngineProxy({ tickRate: ENGINE_CONSTANTS.TICK_RATE }), []);

    // 1. Settings
    const settings = useSimulationSettings(engine);

    // 2. Lifecycle & Sync
    const sync = useEngineSync(engine, settings.speed, settings.worldScale);

    // 3. Stats & History
    const statsInfo = useSimulationStats(engine, settings.speed);

    // 4. Hover state
    const hover = useHoverState();

    // 5. Hotkeys
    useHotkeys(settings.setSpeed);

    /** Initialize loader latency. */
    useEffect(() => {
        const timer = setTimeout(() => sync.setIsLoading(false), UI_CONTROLS.LOADING_DELAY);
        return () => clearTimeout(timer);
    }, [sync]);

    const onReset = useCallback(() => {
        logger.info('UI: Reset Simulation requested', 'SimulationContext');
        localStorage.clear();
        engine.reset();
        statsInfo.resetHistory();
    }, [engine, statsInfo]);

    const value = useMemo(() => ({
        engine, stats: statsInfo.stats, history: statsInfo.history,
        speed: settings.speed, setSpeed: settings.setSpeed,
        worldScale: settings.worldScale, setWorldScale: settings.setWorldScale,
        isLoading: sync.isLoading, onReset,
        cameraState: sync.cameraState, setCameraState: sync.setCameraState,
        hoveredEntity: hover.hoveredEntity, setHoveredEntity: hover.setHoveredEntity,
        tooltipVisible: hover.tooltipVisible, tooltipPos: hover.tooltipPos, setTooltipPos: hover.setTooltipPos,
        autoRotate: settings.autoRotate, setAutoRotate: settings.setAutoRotate,
        autoRotateSpeed: settings.autoRotateSpeed, setAutoRotateSpeed: settings.setAutoRotateSpeed,
    }), [
        engine, statsInfo.stats, statsInfo.history, settings.speed, settings.setSpeed,
        settings.worldScale, settings.setWorldScale, sync.isLoading, onReset,
        sync.cameraState, sync.setCameraState, hover.hoveredEntity, hover.setHoveredEntity,
        hover.tooltipVisible, hover.tooltipPos, hover.setTooltipPos,
        settings.autoRotate, settings.setAutoRotate, settings.autoRotateSpeed, settings.setAutoRotateSpeed
    ]);

    return (
        <SimulationContext.Provider value={value}>
            {children}
        </SimulationContext.Provider>
    );
};
