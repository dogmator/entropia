
import { useCallback,useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality,SimulationConfig } from '@/types';

export const useSettingsState = (engine: ISimulationEngine) => {
    const [config, setConfig] = useState<SimulationConfig>(engine.config);

    const update = useCallback(<K extends keyof SimulationConfig>(key: K, val: number) => {
        const newCfg = { ...config, [key]: val, graphicsQuality: 'CUSTOM' as const };
        setConfig(newCfg);
        engine.updateConfig({ [key]: val, graphicsQuality: 'CUSTOM' });
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
