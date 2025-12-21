
import React, { useState } from 'react';
import { SimulationEngine } from '../simulation/Engine';

interface SettingsPanelProps {
  engine: SimulationEngine;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine }) => {
  const [config, setConfig] = useState(engine.config);
  const [collapsed, setCollapsed] = useState(false);

  const update = <K extends keyof typeof config>(key: K, val: number) => {
    const newConfig = { ...config, [key]: val };
    setConfig(newConfig);
    // Безпечне оновлення конфігурації engine
    (engine.config as any)[key] = val;
  };

  const Slider = ({ label, value, min, max, step, param, colorClass = "accent-emerald-500" }: {
    label: string, value: number, min: number, max: number, step: number, param: keyof typeof config, colorClass?: string
  }) => (
    <div className="group flex flex-col gap-1.5 mb-4 last:mb-0">
      <div className="flex justify-between items-center text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
        <span className="font-bold">{label}</span>
        <span className="font-mono font-black text-white bg-white/5 px-2 py-0.5 rounded text-[10px] sm:text-[9px] min-w-[36px] text-center">
          {value.toFixed(step >= 1 ? 0 : 2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => update(param, parseFloat(e.target.value))}
        className={`w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer ${colorClass} hover:bg-white/20 transition-all touch-manipulation`}
      />
    </div>
  );

  return (
    <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="px-4 sm:px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-all group border-b border-white/5 touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 transition-all duration-300 ${collapsed ? '-rotate-90 scale-90 opacity-50' : 'rotate-0'}`}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div>
            <h2 className="text-[12px] sm:text-[11px] font-black text-white uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">
              Конфігурація
            </h2>
            <div className="text-[8px] sm:text-[7px] text-gray-600 uppercase tracking-widest font-black -mt-0.5">Параметри пісочниці</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] sm:text-[9px] text-emerald-500/80 font-mono font-black px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">v2.5</span>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className={`transition-all duration-500 ease-in-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[1600px] opacity-100'}`}>
        <div className="p-4 sm:p-5 space-y-9 overflow-y-auto custom-scrollbar max-h-[60vh]">
          
          {/* Group 1: Physics & Core */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-emerald-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-emerald-500/20" />
              Біосфера
              <div className="h-px flex-1 bg-emerald-500/20" />
            </h3>
            <Slider label="Темп їжі" param="foodSpawnRate" value={config.foodSpawnRate} min={0} max={1} step={0.05} />
            <Slider label="Ліміт їжі" param="maxFood" value={config.maxFood} min={50} max={2000} step={50} />
            <Slider label="Опір (Drag)" param="drag" value={config.drag} min={0.8} max={1.0} step={0.005} />
            <Slider label="Шанс Мутації" param="mutationFactor" value={config.mutationFactor} min={0.01} max={0.5} step={0.01} />
            <Slider label="Поріг Поділу" param="reproductionThreshold" value={config.reproductionThreshold} min={100} max={500} step={10} />
          </section>

          {/* Group 2: AI / Boids */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-blue-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-blue-500/20" />
              Інстинкти
              <div className="h-px flex-1 bg-blue-500/20" />
            </h3>
            <Slider label="Розділення" param="separationWeight" value={config.separationWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" />
            <Slider label="Пошук (Seek)" param="seekWeight" value={config.seekWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" />
            <Slider label="Ухилення (Avoid)" param="avoidWeight" value={config.avoidWeight} min={0} max={20} step={0.1} colorClass="accent-blue-500" />
          </section>

          {/* Group 3: Visualization */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-amber-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-amber-500/20" />
              Візуалізація
              <div className="h-px flex-1 bg-amber-500/20" />
            </h3>
            <Slider label="Прозорість тіл" param="organismOpacity" value={config.organismOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" />
            <Slider label="Розмір тіл" param="organismScale" value={config.organismScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" />
            <Slider label="Прозорість їжі" param="foodOpacity" value={config.foodOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" />
            <Slider label="Розмір їжі" param="foodScale" value={config.foodScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" />
            <Slider label="Сітка світу" param="gridOpacity" value={config.gridOpacity} min={0.0} max={0.5} step={0.01} colorClass="accent-amber-500" />
          </section>

        </div>

        {/* Panel Footer */}
        <div className="px-4 sm:px-5 py-3 bg-white/[0.02] border-t border-white/5 flex justify-center">
           <div className="text-[9px] sm:text-[8px] text-gray-600 font-black uppercase tracking-widest animate-pulse">
             Система активна • Стабільна частота
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
