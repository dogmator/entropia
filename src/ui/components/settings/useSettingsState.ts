import { useCallback, useEffect, useRef, useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import { logger } from '@/core';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

import { type UrlHistoryMode } from './urlConfigSync';
import { clampToLimits, getInitialConfig, sanitizeConfig, syncUrlDebounced } from './useSettingsState.utils';
import { useUrlSync } from './useUrlSync';

const URL_SYNC_DEBOUNCE_MS = 180;
const SETTINGS_SOURCE = 'UI:Settings';

export interface SettingsState {
    config: SimulationConfig;
    update: (key: keyof SimulationConfig, val: number) => void;
    toggle: (key: keyof SimulationConfig) => void;
    applyPreset: (quality: GraphicsQuality) => void;
}

export type InitialConfigSource = 'url' | 'engine';

// The first settings panel of a page takes its configuration from the URL. A panel that replaces an earlier one, after a
// restore or an import, takes the live configuration, because the URL still describes the world that was replaced.
export const initialConfigFor = (engine: ISimulationEngine, source: InitialConfigSource): SimulationConfig => {
    if (source === 'engine') return { ...engine.config };
    const parsed = getInitialConfig(engine.config);
    logger.info('URL-first init', 'useSettingsState', { url: window.location.search, config: parsed });
    return parsed;
};

export const useSettingsState = (engine: ISimulationEngine, initialSource: InitialConfigSource = 'url'): SettingsState => {
    const defaultConfigRef = useRef<SimulationConfig>({ ...engine.config });
    // A live configuration is already in the engine, so the mount must not push anything to it.
    const didApplyInitialUrlStateRef = useRef(initialSource === 'engine');
    const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [config, setConfig] = useState<SimulationConfig>(() => initialConfigFor(engine, initialSource));

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
        logger.info('setting changed', SETTINGS_SOURCE, { key, from: currentValue, to: safeValue });
        applyConfig({ ...config, [key]: safeValue, graphicsQuality: 'CUSTOM' }, 'replace', false);
    }, [applyConfig, config]);

    const toggle = useCallback((key: keyof SimulationConfig) => {
        const currentVal = config[key];
        if (typeof currentVal !== 'boolean') return;
        logger.info('setting toggled', SETTINGS_SOURCE, { key, from: currentVal, to: !currentVal });
        applyConfig({ ...config, [key]: !currentVal, graphicsQuality: 'CUSTOM' }, 'push', false);
    }, [applyConfig, config]);

    const applyPreset = useCallback((quality: GraphicsQuality) => {
        if (quality === 'CUSTOM') return;
        logger.info('graphics preset applied', SETTINGS_SOURCE, { quality });
        applyConfig({ ...config, ...GRAPHICS_PRESETS[quality], graphicsQuality: quality }, 'push', false);
    }, [applyConfig, config]);

    return { config, update, toggle, applyPreset };
};
