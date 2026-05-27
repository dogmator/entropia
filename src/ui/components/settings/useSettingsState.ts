import { useCallback, useEffect, useRef, useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

import { type MutableSimulationConfig, parseConfigFromSearch, type UrlHistoryMode, updateUrlFromConfig } from './urlConfigSync';

/** Затримка дебаунсу для replaceState при частих змінах (слайдери). */
const URL_SYNC_DEBOUNCE_MS = 180;

type WritableConfigRecord = Record<keyof SimulationConfig, SimulationConfig[keyof SimulationConfig]>;

const CONFIG_LIMITS: Partial<Record<keyof SimulationConfig, { min: number; max: number }>> = {
    foodSpawnRate: { min: 0, max: 1 },
    maxFood: { min: 50, max: 2000 },
    maxOrganisms: { min: 10, max: 1000 },
    drag: { min: 0.8, max: 1 },
    mutationFactor: { min: 0.01, max: 0.5 },
    reproductionThreshold: { min: 100, max: 500 },
    bloomIntensity: { min: 0, max: 5 },
    trailLength: { min: 0, max: 60 },
    organismScale: { min: 0.3, max: 3 },
    foodScale: { min: 0.2, max: 3 },
};

const clampToLimits = <K extends keyof SimulationConfig>(key: K, value: number): number => {
    const limits = CONFIG_LIMITS[key];
    if (!limits) {
        return value;
    }

    return Math.min(limits.max, Math.max(limits.min, value));
};

const isGraphicsQuality = (value: string): value is GraphicsQuality => {
    if (value === 'CUSTOM') {
        return true;
    }

    return Object.hasOwn(GRAPHICS_PRESETS, value);
};

/**
 * Санітизація окремого поля конфігурації: перевіряє тип, скидає на default
 * при невалідних значеннях, застосовує обмеження CONFIG_LIMITS для числових полів.
 */
const sanitizeConfigValue = <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K],
    defaultValue: SimulationConfig[K]
): SimulationConfig[K] => {
    if (typeof defaultValue === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return defaultValue;
        }
        return clampToLimits(key, value) as SimulationConfig[K];
    }

    if (typeof defaultValue === 'boolean') {
        return typeof value === 'boolean' ? value : defaultValue;
    }

    if (key === 'graphicsQuality') {
        if (typeof value !== 'string') {
            return defaultValue;
        }

        return isGraphicsQuality(value) ? value : defaultValue;
    }

    if (typeof defaultValue === 'string') {
        return typeof value === 'string' ? value : defaultValue;
    }

    return value;
};

/**
 * Повна санітизація SimulationConfig: застосовує sanitizeConfigValue до кожного поля.
 * Гарантує, що повернутий об'єкт не містить невалідних або виходячих за межі значень.
 */
const sanitizeConfig = (config: SimulationConfig, defaultConfig: SimulationConfig): SimulationConfig => {
    const nextConfig = { ...defaultConfig } as MutableSimulationConfig;
    const writable = nextConfig as WritableConfigRecord;

    (Object.keys(defaultConfig) as (keyof SimulationConfig)[]).forEach((key) => {
        writable[key] = sanitizeConfigValue(key, config[key], defaultConfig[key]);
    });

    return nextConfig;
};

export const useSettingsState = (engine: ISimulationEngine) => {
    const defaultConfig = { ...engine.config };
    const defaultConfigRef = useRef<SimulationConfig>(defaultConfig);
    const isUrlDrivenUpdateRef = useRef(false);
    const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didApplyInitialUrlStateRef = useRef(false);

    const [config, setConfig] = useState<SimulationConfig>(() => {
        const parsedConfig = parseConfigFromSearch(window.location.search, defaultConfig, {
            graphicsQuality: (value, fallback) => (isGraphicsQuality(value) ? value : fallback),
        });

        return sanitizeConfig(parsedConfig, defaultConfig);
    });

    const syncUrl = useCallback((nextConfig: SimulationConfig, mode: UrlHistoryMode) => {
        if (mode === 'push') {
            if (urlSyncTimerRef.current) {
                clearTimeout(urlSyncTimerRef.current);
                urlSyncTimerRef.current = null;
            }
            updateUrlFromConfig(nextConfig, defaultConfigRef.current, 'push');
            return;
        }

        if (urlSyncTimerRef.current) {
            clearTimeout(urlSyncTimerRef.current);
        }

        urlSyncTimerRef.current = setTimeout(() => {
            updateUrlFromConfig(nextConfig, defaultConfigRef.current, 'replace');
            urlSyncTimerRef.current = null;
        }, URL_SYNC_DEBOUNCE_MS);
    }, []);

    const applyConfig = useCallback((nextConfig: SimulationConfig, mode: UrlHistoryMode, isUrlEvent = false) => {
        const sanitizedConfig = sanitizeConfig(nextConfig, defaultConfigRef.current);

        setConfig(sanitizedConfig);
        engine.updateConfig(sanitizedConfig);

        if (isUrlEvent) {
            return;
        }

        syncUrl(sanitizedConfig, mode);
    }, [engine, syncUrl]);

    useEffect(() => {
        if (didApplyInitialUrlStateRef.current) {
            return;
        }

        const baseConfig = defaultConfigRef.current;
        const hasInitialOverrides = Object.keys(baseConfig).some((rawKey) => {
            const key = rawKey as keyof SimulationConfig;
            return baseConfig[key] !== config[key];
        });

        if (hasInitialOverrides) {
            engine.updateConfig(config);
        }

        didApplyInitialUrlStateRef.current = true;
    }, [config, engine]);

    useEffect(() => {
        const onPopState = () => {
            const parsedConfig = parseConfigFromSearch(window.location.search, defaultConfigRef.current, {
                graphicsQuality: (value, fallback) => (isGraphicsQuality(value) ? value : fallback),
            });

            isUrlDrivenUpdateRef.current = true;
            applyConfig(parsedConfig, 'replace', true);
            isUrlDrivenUpdateRef.current = false;
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            if (urlSyncTimerRef.current) {
                clearTimeout(urlSyncTimerRef.current);
                urlSyncTimerRef.current = null;
            }
        };
    }, [applyConfig]);

    const update = useCallback(<K extends keyof SimulationConfig>(key: K, val: number) => {
        const currentValue = config[key];
        if (typeof currentValue !== 'number') {
            return;
        }

        const safeValue = clampToLimits(key, val);
        if (currentValue === safeValue) {
            return;
        }

        const newCfg = { ...config, [key]: safeValue, graphicsQuality: 'CUSTOM' as const };
        applyConfig(newCfg, 'replace', isUrlDrivenUpdateRef.current);
    }, [applyConfig, config]);

    const toggle = useCallback((key: keyof SimulationConfig) => {
        const currentVal = config[key];
        if (typeof currentVal !== 'boolean') {
            return;
        }

        const newCfg = { ...config, [key]: !currentVal, graphicsQuality: 'CUSTOM' as const };
        applyConfig(newCfg, 'push', isUrlDrivenUpdateRef.current);
    }, [applyConfig, config]);

    const applyPreset = useCallback((quality: GraphicsQuality) => {
        if (quality === 'CUSTOM') return;
        const preset = GRAPHICS_PRESETS[quality];
        const newCfg = { ...config, ...preset, graphicsQuality: quality };
        applyConfig(newCfg, 'push', isUrlDrivenUpdateRef.current);
    }, [applyConfig, config]);

    return { config, update, toggle, applyPreset };
};
