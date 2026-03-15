
import { useCallback,useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality,SimulationConfig } from '@/types';

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

export const useSettingsState = (engine: ISimulationEngine) => {
    const [config, setConfig] = useState<SimulationConfig>(engine.config);

    const update = useCallback(<K extends keyof SimulationConfig>(key: K, val: number) => {
        const safeValue = clampToLimits(key, val);
        const currentValue = config[key];
        if (typeof currentValue === 'number' && currentValue === safeValue) {
            return;
        }

        const newCfg = { ...config, [key]: safeValue, graphicsQuality: 'CUSTOM' as const };
        setConfig(newCfg);
        engine.updateConfig({ [key]: safeValue, graphicsQuality: 'CUSTOM' });
    }, [config, engine]);

    const toggle = useCallback((key: keyof SimulationConfig) => {
        const currentVal = config[key];
        if (typeof currentVal === 'boolean') {
            const newVal = !currentVal;
            const newCfg = { ...config, [key]: newVal, graphicsQuality: 'CUSTOM' as const };
            setConfig(newCfg);
            engine.updateConfig({ [key]: newVal, graphicsQuality: 'CUSTOM' });
        }
    }, [config, engine]);

    const applyPreset = useCallback((quality: GraphicsQuality) => {
        if (quality === 'CUSTOM') return;
        const preset = GRAPHICS_PRESETS[quality];
        const newCfg = { ...config, ...preset, graphicsQuality: quality };
        setConfig(newCfg);
        engine.updateConfig(newCfg);
    }, [config, engine]);

    return { config, update, toggle, applyPreset };
};
