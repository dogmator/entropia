import { useCallback, useEffect, useRef, useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import { logger } from '@/core';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

import { type UrlHistoryMode } from './urlConfigSync';
import { clampToLimits, getInitialConfig, sanitizeConfig, syncUrlDebounced } from './useSettingsState.utils';
import { useUrlSync } from './useUrlSync';

const URL_SYNC_DEBOUNCE_MS = 180;

export interface SettingsState {
    config: SimulationConfig;
    update: (key: keyof SimulationConfig, val: number) => void;
    toggle: (key: keyof SimulationConfig) => void;
    applyPreset: (quality: GraphicsQuality) => void;
}

export const useSettingsState = (engine: ISimulationEngine): SettingsState => {
    const defaultConfigRef = useRef<SimulationConfig>({ ...engine.config });
    const didApplyInitialUrlStateRef = useRef(false);
    const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [config, setConfig] = useState<SimulationConfig>(() => {
        const parsed = getInitialConfig(engine.config);
        logger.info('URL-first init', 'useSettingsState', { url: window.location.search, config: parsed });
        return parsed;
    });

    const applyConfig = useCallback((nextConfig: SimulationConfig, mode: UrlHistoryMode, isUrlEvent: boolean) => {
        const sanitizedConfig = sanitizeConfig(nextConfig, defaultConfigRef.current);
        logger.info('URL-first applyConfig', 'useSettingsState', { mode, isUrlEvent, url: window.location.search });
        setConfig(sanitizedConfig);
        engine.updateConfig(sanitizedConfig);
        if (!isUrlEvent) {
            syncUrlDebounced({
                nextConfig: sanitizedConfig,
                defaultConfig: defaultConfigRef.current,
                mode,
                timerRef: urlSyncTimerRef,
                debounceMs: URL_SYNC_DEBOUNCE_MS
            });
        }
    }, [engine]);

    useUrlSync(defaultConfigRef, applyConfig, urlSyncTimerRef);

    useEffect(() => {
        if (didApplyInitialUrlStateRef.current) return;
        const baseConfig = defaultConfigRef.current;
        if (Object.keys(baseConfig).some((k) => baseConfig[k as keyof SimulationConfig] !== config[k as keyof SimulationConfig])) {
            engine.updateConfig(config);
        }
        didApplyInitialUrlStateRef.current = true;
    }, [config, engine]);

    const update = useCallback((key: keyof SimulationConfig, val: number) => {
        const currentValue = config[key];
        if (typeof currentValue !== 'number') return;
        const safeValue = clampToLimits(key, val);
        if (currentValue === safeValue) return;
        applyConfig({ ...config, [key]: safeValue, graphicsQuality: 'CUSTOM' }, 'replace', false);
    }, [applyConfig, config]);

    const toggle = useCallback((key: keyof SimulationConfig) => {
        const currentVal = config[key];
        if (typeof currentVal !== 'boolean') return;
        applyConfig({ ...config, [key]: !currentVal, graphicsQuality: 'CUSTOM' }, 'push', false);
    }, [applyConfig, config]);

    const applyPreset = useCallback((quality: GraphicsQuality) => {
        if (quality === 'CUSTOM') return;
        applyConfig({ ...config, ...GRAPHICS_PRESETS[quality], graphicsQuality: quality }, 'push', false);
    }, [applyConfig, config]);

    return { config, update, toggle, applyPreset };
};
