import { createContext, ReactNode,useContext } from 'react';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

interface SettingsContextValue {
    config: SimulationConfig;
    update: <K extends keyof SimulationConfig>(key: K, val: number) => void;
    toggle: (key: keyof SimulationConfig) => void;
    applyPreset: (quality: GraphicsQuality) => void;
    engine: ISimulationEngine;
    worldScale: number;
    onWorldScaleChange: (val: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider = ({ children, value }: { children: ReactNode; value: SettingsContextValue }) => (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};
