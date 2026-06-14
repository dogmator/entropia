import type { ReactNode } from 'react';
import type React from 'react';
import { createContext, useContext } from 'react';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { GraphicsQuality, SimulationConfig } from '@/types';

interface SettingsContextValue {
    config: SimulationConfig;
    update: (key: keyof SimulationConfig, val: number) => void;
    toggle: (key: keyof SimulationConfig) => void;
    applyPreset: (quality: GraphicsQuality) => void;
    engine: ISimulationEngine;
    worldScale: number;
    onWorldScaleChange: (val: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

 
export const SettingsProvider = ({ children, value }: { children: ReactNode; value: SettingsContextValue }): React.JSX.Element => (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = (): SettingsContextValue => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};
