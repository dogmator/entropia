import React, { useMemo, useState } from 'react';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { useSimulation } from '../context/SimulationContext';
import { AdvancedSettings } from './settings/AdvancedSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { PerformanceSettings } from './settings/PerformanceSettings';
import { SettingsProvider } from './settings/SettingsContext';
import { useSettingsState } from './settings/useSettingsState';

interface SettingsPanelProps {
  engine: ISimulationEngine;
  worldScale: number;
  onWorldScaleChange: (val: number) => void;
}

const PANEL_VERSION = 'v2.5';

const PanelHeader = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full px-5 py-4 flex justify-between items-center hover:bg-white/10 transition-all duration-300 group border-b border-white/5 text-left bg-transparent"
  >
    <div className="flex items-center gap-3">
      <div className={`p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 transition-all duration-300 ${collapsed ? '-rotate-90 scale-90 opacity-50' : 'rotate-0'}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div>
        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">
          Конфігуратор
        </h2>
        <div className="text-[7px] text-gray-600 uppercase tracking-widest font-black -mt-0.5">Параметри середовища</div>
      </div>
    </div>
    <span className="text-[9px] text-emerald-500/80 font-mono font-black px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
      {PANEL_VERSION}
    </span>
  </button>
);

const PanelFooter = () => (
  <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex justify-center text-center">
    <div className="text-[8px] text-gray-600 font-black uppercase tracking-widest animate-pulse">
      Система активна • Моніторинг стабільний
    </div>
  </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  engine, worldScale, onWorldScaleChange
}) => {
  const { isLoading } = useSimulation();
  const { config, update, toggle, applyPreset } = useSettingsState(engine);
  const [collapsed, setCollapsed] = useState(false);

  const contextValue = useMemo(() => ({
    config, update, toggle, applyPreset, engine, worldScale, onWorldScaleChange
  }), [config, update, toggle, applyPreset, engine, worldScale, onWorldScaleChange]);

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex items-center justify-center animate-pulse">
        <div className="text-gray-400 text-xs font-mono uppercase tracking-widest">Initialization...</div>
      </div>
    );
  }

  return (
    <SettingsProvider value={contextValue}>
      <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
        <PanelHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className={`transition-all duration-500 ease-in-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[1600px] opacity-100'}`}>
          <div className="p-5 space-y-9 overflow-y-auto custom-scrollbar max-h-[60vh]">
            <GeneralSettings />
            <AdvancedSettings />
            <PerformanceSettings />
          </div>
          <PanelFooter />
        </div>
      </div>
    </SettingsProvider>
  );
};
