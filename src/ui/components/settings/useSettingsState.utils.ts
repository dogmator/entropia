import type React from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import type { GraphicsQuality, SimulationConfig } from '@/types';

import { type MutableSimulationConfig, parseConfigFromSearch, updateUrlFromConfig } from './urlConfigSync';

export const CONFIG_LIMITS: Partial<Record<keyof SimulationConfig, { min: number; max: number }>> = {
    foodSpawnRate: { min: 0, max: 1 },
    maxFood: { min: 50, max: 2000 },
    maxOrganisms: { min: 10, max: 1000 },
    drag: { min: 0.8, max: 1 },
    mutationFactor: { min: 0.01, max: 0.5 },
    reproductionThreshold: { min: 100, max: 500 },
    bloomIntensity: { min: 0, max: 5 },
    trailLength: { min: 0, max: 120 },
    organismScale: { min: 0.3, max: 3 },
    foodScale: { min: 0.2, max: 3 },
};

export const clampToLimits = (key: keyof SimulationConfig, value: number): number => {
    const limits = CONFIG_LIMITS[key];
    if (!limits) return value;
    return Math.min(limits.max, Math.max(limits.min, value));
};

export const isGraphicsQuality = (value: string): value is GraphicsQuality => 
    value === 'CUSTOM' || Object.hasOwn(GRAPHICS_PRESETS, value);

type WritableConfigRecord = Record<keyof SimulationConfig, SimulationConfig[keyof SimulationConfig]>;

const sanitizeNumericValue = <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K],
    defaultValue: SimulationConfig[K]
): SimulationConfig[K] => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return defaultValue;
    return clampToLimits(key, value) as SimulationConfig[K];
};

export const sanitizeConfigValue = <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K],
    defaultValue: SimulationConfig[K]
): SimulationConfig[K] => {
    if (typeof defaultValue === 'number') return sanitizeNumericValue(key, value, defaultValue);
    if (typeof defaultValue === 'boolean') return typeof value === 'boolean' ? value : defaultValue;
    if (key === 'graphicsQuality') {
        return typeof value === 'string' && isGraphicsQuality(value) ? value : defaultValue;
    }
    if (typeof defaultValue === 'string') return typeof value === 'string' ? value : defaultValue;
    return value;
};

export const sanitizeConfig = (config: SimulationConfig, defaultConfig: SimulationConfig): SimulationConfig => {
    const nextConfig = { ...defaultConfig } as MutableSimulationConfig;
    const writable = nextConfig as WritableConfigRecord;
    (Object.keys(defaultConfig) as (keyof SimulationConfig)[]).forEach((key) => {
        writable[key] = sanitizeConfigValue(key, config[key], defaultConfig[key]);
    });
    return nextConfig;
};

export const getInitialConfig = (defaultConfig: SimulationConfig): SimulationConfig => {
    const parsedConfig = parseConfigFromSearch(window.location.search, defaultConfig, {
        graphicsQuality: (value, fallback) => (isGraphicsQuality(value) ? value : fallback),
    });
    return sanitizeConfig(parsedConfig, defaultConfig);
};

interface SyncUrlParams {
    nextConfig: SimulationConfig;
    defaultConfig: SimulationConfig;
    mode: 'push' | 'replace';
    timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
    debounceMs: number;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export const syncUrlDebounced = (params: SyncUrlParams): void => {
    const { nextConfig, defaultConfig, mode, timerRef, debounceMs } = params;
    const mRef = timerRef as Mutable<typeof timerRef>;
    if (mode === 'push') {
        if (mRef.current) {
            clearTimeout(mRef.current);
            mRef.current = null;
        }
        updateUrlFromConfig(nextConfig, defaultConfig, 'push');
        return;
    }
    if (mRef.current) clearTimeout(mRef.current);
    mRef.current = setTimeout(() => {
        updateUrlFromConfig(nextConfig, defaultConfig, 'replace');
        mRef.current = null;
    }, debounceMs);
};
