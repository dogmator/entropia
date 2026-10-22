import { useCallback, useEffect, useRef, useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import { logger } from '@/core';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

import { settingsChangedBetween, type UrlHistoryMode } from './urlConfigSync';
import { cancelUrlWrite, clampToLimits, getInitialConfig, pickSettings, sanitizeConfig, syncUrlDebounced } from './useSettingsState.utils';
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

type ApplyConfig = (nextConfig: SimulationConfig, mode: UrlHistoryMode, touched: readonly (keyof SimulationConfig)[]) => void;

// The settings a graphics preset sets, which include its own quality.
const presetSettings = (quality: Exclude<GraphicsQuality, 'CUSTOM'>): (keyof SimulationConfig)[] =>
    Object.keys(GRAPHICS_PRESETS[quality]) as (keyof SimulationConfig)[];

// The defaults that a parameter stands for when the address does not name it. They are the configuration the engine had before
// any address or restore changed it. A panel that remounts after a restore keeps them, because the restored world is not the default.
const urlDefaults = new WeakMap<ISimulationEngine, SimulationConfig>();
const urlDefaultsOf = (engine: ISimulationEngine): SimulationConfig => {
    const known = urlDefaults.get(engine);
    if (known) return known;
    const defaults = { ...engine.config };
    urlDefaults.set(engine, defaults);
    return defaults;
};

// The first settings panel of a page takes its configuration from the URL. A panel that replaces an earlier one, after a
// restore or an import, takes the live configuration, because the URL still describes the world that was replaced.
export const initialConfigFor = (engine: ISimulationEngine, source: InitialConfigSource): SimulationConfig => {
    if (source === 'engine') return { ...engine.config };
    const parsed = getInitialConfig(engine.config);
    logger.info('URL-first init', 'useSettingsState', { url: window.location.search, config: parsed });
    return parsed;
};

// The configuration of a settings panel, kept in step with the engine and with the address.
const useSyncedConfig = (engine: ISimulationEngine, initialSource: InitialConfigSource): { config: SimulationConfig; applyConfig: ApplyConfig } => {
    const defaultConfigRef = useRef<SimulationConfig>(urlDefaultsOf(engine));
    // A live configuration is already in the engine, so the mount must not push anything to it.
    const didApplyInitialUrlStateRef = useRef(initialSource === 'engine');
    const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The address that the panel last agreed with: the one it wrote, or the one the browser moved to. A navigation is measured from it.
    const knownSearchRef = useRef(window.location.search);

    const [config, setConfig] = useState<SimulationConfig>(() => initialConfigFor(engine, initialSource));
    // The configuration as the panel last set it. A navigation builds on it, not on a value captured by an earlier render.
    const latestConfigRef = useRef(config);

    // A change sends only the settings it touches. The other values in the panel may predate a restore or an import, and
    // sending them would replace the world's own values.
    const applyConfig = useCallback<ApplyConfig>((nextConfig, mode, touched) => {
        const sanitizedConfig = sanitizeConfig(nextConfig, defaultConfigRef.current);
        logger.info('URL-first applyConfig', 'useSettingsState', { mode, url: window.location.search });
        latestConfigRef.current = sanitizedConfig;
        setConfig(sanitizedConfig);
        engine.updateConfig(pickSettings(sanitizedConfig, touched));
        syncUrlDebounced({
            nextConfig: sanitizedConfig,
            defaultConfig: defaultConfigRef.current,
            mode,
            timerRef: urlSyncTimerRef,
            debounceMs: URL_SYNC_DEBOUNCE_MS,
            onWritten: (search) => { knownSearchRef.current = search; },
        });
    }, [engine]);

    // Back and Forward move the page to another address. Only the settings that the two addresses differ in are applied, so the
    // rest of the world keeps its values. A URL write still waiting for its debounce is dropped, because it describes the page
    // the user has left.
    const onNavigate = useCallback(() => {
        cancelUrlWrite(urlSyncTimerRef);
        const nextSearch = window.location.search;
        const changed = settingsChangedBetween(knownSearchRef.current, nextSearch, defaultConfigRef.current);
        knownSearchRef.current = nextSearch;
        const changedKeys = Object.keys(changed) as (keyof SimulationConfig)[];
        if (changedKeys.length === 0) return;
        const nextConfig = sanitizeConfig({ ...latestConfigRef.current, ...changed }, defaultConfigRef.current);
        logger.info('settings applied from history', 'useSettingsState', { keys: changedKeys, url: nextSearch });
        latestConfigRef.current = nextConfig;
        setConfig(nextConfig);
        engine.updateConfig(pickSettings(nextConfig, changedKeys));
    }, [engine]);

    useUrlSync(onNavigate);

    // A write still waiting in this panel must not reach the address after the panel has gone, for example after a restore.
    useEffect(() => () => { cancelUrlWrite(urlSyncTimerRef); }, []);

    useEffect(() => {
        if (didApplyInitialUrlStateRef.current) return;
        const baseConfig = defaultConfigRef.current;
        if (Object.keys(baseConfig).some((k) => baseConfig[k as keyof SimulationConfig] !== config[k as keyof SimulationConfig])) {
            engine.updateConfig(config);
        }
        didApplyInitialUrlStateRef.current = true;
    }, [config, engine]);

    return { config, applyConfig };
};

export const useSettingsState = (engine: ISimulationEngine, initialSource: InitialConfigSource = 'url'): SettingsState => {
    const { config, applyConfig } = useSyncedConfig(engine, initialSource);

    const update = useCallback((key: keyof SimulationConfig, val: number) => {
        const currentValue = config[key];
        if (typeof currentValue !== 'number') return;
        const safeValue = clampToLimits(key, val);
        if (currentValue === safeValue) return;
        logger.info('setting changed', SETTINGS_SOURCE, { key, from: currentValue, to: safeValue });
        applyConfig({ ...config, [key]: safeValue, graphicsQuality: 'CUSTOM' }, 'replace', [key, 'graphicsQuality']);
    }, [applyConfig, config]);

    const toggle = useCallback((key: keyof SimulationConfig) => {
        const currentVal = config[key];
        if (typeof currentVal !== 'boolean') return;
        logger.info('setting toggled', SETTINGS_SOURCE, { key, from: currentVal, to: !currentVal });
        applyConfig({ ...config, [key]: !currentVal, graphicsQuality: 'CUSTOM' }, 'push', [key, 'graphicsQuality']);
    }, [applyConfig, config]);

    const applyPreset = useCallback((quality: GraphicsQuality) => {
        if (quality === 'CUSTOM') return;
        logger.info('graphics preset applied', SETTINGS_SOURCE, { quality });
        applyConfig({ ...config, ...GRAPHICS_PRESETS[quality], graphicsQuality: quality }, 'push', presetSettings(quality));
    }, [applyConfig, config]);

    return { config, update, toggle, applyPreset };
};
