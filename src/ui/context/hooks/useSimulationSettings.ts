import { useCallback, useEffect, useState } from 'react';

import { CAMERA, UI_CONTROLS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

// ============================================================================
// UIConfig — parameters not included in SimulationConfig
// ============================================================================

export interface CameraSnapshot {
    px: number; py: number; pz: number; // camera world position
    tx: number; ty: number; tz: number; // orbit target
}

interface UIConfig {
    speed: number;
    worldScale: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    cameraSnapshot: CameraSnapshot | null; // null = use scene default
}

const UI_DEFAULTS: UIConfig = {
    speed: UI_CONTROLS.SPEED.DEFAULT,
    worldScale: UI_CONTROLS.WORLD_SCALE.DEFAULT,
    autoRotate: CAMERA.AUTO_ROTATE.ENABLED,
    autoRotateSpeed: CAMERA.AUTO_ROTATE.SPEED,
    cameraSnapshot: null,
};

// ============================================================================
// URL helpers
// ============================================================================

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const CAM_KEYS = ['camX', 'camY', 'camZ', 'camTX', 'camTY', 'camTZ'] as const;

interface NumericParamOptions {
    min: number;
    max: number;
    fallback: number;
}

const readUIFromUrl = (): UIConfig => {
    const params = new URLSearchParams(window.location.search);

    const parseNum = (key: string, options: NumericParamOptions): number => {
        const { min, max, fallback } = options;
        const raw = params.get(key);
        if (raw === null) return fallback;
        const v = Number(raw);
        return Number.isFinite(v) ? clamp(v, min, max) : fallback;
    };

    const parseBool = (key: string, fallback: boolean): boolean => {
        const raw = params.get(key);
        if (raw === 'true' || raw === '1') return true;
        if (raw === 'false' || raw === '0') return false;
        return fallback;
    };

    const parseFinite = (key: string): number | null => {
        const raw = params.get(key);
        if (raw === null) return null;
        const v = Number(raw);
        return Number.isFinite(v) ? v : null;
    };

    const px = parseFinite('camX');
    const py = parseFinite('camY');
    const pz = parseFinite('camZ');
    const tx = parseFinite('camTX');
    const ty = parseFinite('camTY');
    const tz = parseFinite('camTZ');
    const cameraSnapshot: CameraSnapshot | null =
        px !== null && py !== null && pz !== null &&
        tx !== null && ty !== null && tz !== null
            ? { px, py, pz, tx, ty, tz }
            : null;

    return {
        speed: parseNum('speed', { min: UI_CONTROLS.SPEED.MIN, max: UI_CONTROLS.SPEED.MAX, fallback: UI_DEFAULTS.speed }),
        worldScale: parseNum('worldScale', { min: UI_CONTROLS.WORLD_SCALE.MIN, max: UI_CONTROLS.WORLD_SCALE.MAX, fallback: UI_DEFAULTS.worldScale }),
        autoRotate: parseBool('autoRotate', UI_DEFAULTS.autoRotate),
        autoRotateSpeed: parseNum('autoRotateSpeed', { min: CAMERA.AUTO_ROTATE.SPEED_MIN, max: CAMERA.AUTO_ROTATE.SPEED_MAX, fallback: UI_DEFAULTS.autoRotateSpeed }),
        cameraSnapshot,
    };
};

const syncUIToUrl = (config: UIConfig): void => {
    const params = new URLSearchParams(window.location.search);

    const setOrDelete = (key: string, value: unknown, defaultValue: unknown): void => {
        if (value === defaultValue) params.delete(key);
        else params.set(key, String(value));
    };

    setOrDelete('speed', config.speed, UI_DEFAULTS.speed);
    setOrDelete('worldScale', config.worldScale, UI_DEFAULTS.worldScale);
    setOrDelete('autoRotate', config.autoRotate, UI_DEFAULTS.autoRotate);
    setOrDelete('autoRotateSpeed', config.autoRotateSpeed, UI_DEFAULTS.autoRotateSpeed);

    if (config.cameraSnapshot !== null) {
        const { px, py, pz, tx, ty, tz } = config.cameraSnapshot;
        params.set('camX', String(Math.round(px)));
        params.set('camY', String(Math.round(py)));
        params.set('camZ', String(Math.round(pz)));
        params.set('camTX', String(Math.round(tx)));
        params.set('camTY', String(Math.round(ty)));
        params.set('camTZ', String(Math.round(tz)));
    } else {
        CAM_KEYS.forEach((key) => {
            params.delete(key);
        });
    }

    const search = params.toString();
    const { pathname, hash } = window.location;
    const nextUrl = search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`;
    const currentUrl = `${pathname}${window.location.search}${hash}`;

    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
};

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
    const [{ speed, worldScale, autoRotate: isAutoRotate, autoRotateSpeed, cameraSnapshot }, setState] = useState<UIConfig>(readUIFromUrl);

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
