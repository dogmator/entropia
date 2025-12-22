
import React, { useState } from 'react';
import { SimulationEngine } from '../simulation/Engine';
import { GRAPHICS_PRESETS } from '../constants';
import { GraphicsQuality } from '../types';

interface SettingsPanelProps {
  engine: SimulationEngine;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine }) => {
  const [config, setConfig] = useState(engine.config);
  const [collapsed, setCollapsed] = useState(false);

  const update = <K extends keyof typeof config>(key: K, val: number) => {
    const newConfig = { ...config, [key]: val, graphicsQuality: 'CUSTOM' as const };
    setConfig(newConfig);
    // Безпечне оновлення конфігурації engine
    Object.assign(engine.config, { [key]: val, graphicsQuality: 'CUSTOM' });
  };

  const toggle = <K extends keyof typeof config>(key: K) => {
    const currentVal = config[key];
    if (typeof currentVal === 'boolean') {
      const newVal = !currentVal;
      const newConfig = { ...config, [key]: newVal, graphicsQuality: 'CUSTOM' as const };
      setConfig(newConfig);
      Object.assign(engine.config, { [key]: newVal, graphicsQuality: 'CUSTOM' });
    }
  };

  const applyPreset = (quality: GraphicsQuality) => {
    if (quality === 'CUSTOM') return;

    const preset = GRAPHICS_PRESETS[quality];
    const newConfig = {
      ...config,
      ...preset,
      graphicsQuality: quality,
    };
    setConfig(newConfig);
    Object.assign(engine.config, newConfig);
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
        className="px-4 sm:px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-all duration-300 group border-b border-white/5 hover:border-emerald-500/20 touch-manipulation"
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
            <Slider label="Ліміт організмів" param="maxOrganisms" value={config.maxOrganisms} min={10} max={1000} step={10} />

            <div className="flex justify-between items-center mb-4 mt-6">
              <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Аномалії (Перешкоди)</span>
              <button
                onClick={() => {
                  const newVal = !config.showObstacles;
                  const newConfig = { ...config, showObstacles: newVal };
                  setConfig(newConfig);
                  Object.assign(engine.config, { showObstacles: newVal });
                }}
                className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showObstacles ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showObstacles ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

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

          {/* Group 4: Graphics / Performance */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-cyan-500/20" />
              ⚡ Графіка
              <div className="h-px flex-1 bg-cyan-500/20" />
            </h3>

            {/* Quality Preset Selector */}
            <div className="mb-6">
              <div className="text-[10px] sm:text-[9px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Налаштування Якості</div>
              <div className="grid grid-cols-4 gap-2 mb-1">
                {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((quality) => (
                  <button
                    key={quality}
                    onClick={() => applyPreset(quality)}
                    className={`h-9 rounded-lg text-[9px] font-bold transition-all duration-200 touch-manipulation ${
                      config.graphicsQuality === quality
                        ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {quality === 'LOW' && '⚡ LOW'}
                    {quality === 'MEDIUM' && '🔧 MED'}
                    {quality === 'HIGH' && '✨ HIGH'}
                    {quality === 'ULTRA' && '💎 ULTRA'}
                  </button>
                ))}
              </div>
              {config.graphicsQuality === 'CUSTOM' && (
                <div className="text-[8px] text-purple-400 text-center mt-1 uppercase tracking-wider">Custom налаштування</div>
              )}
            </div>

            {/* Body Approximation Slider */}
            <div className="mb-6">
              <Slider
                label="Деталізація Геометрії"
                param="bodyQuality"
                value={config.bodyQuality}
                min={8}
                max={64}
                step={4}
                colorClass="accent-cyan-500"
              />
              <div className="text-[8px] text-gray-600 mt-1">
                {config.bodyQuality <= 12 && '⚡ Низька (найшвидше)'}
                {config.bodyQuality > 12 && config.bodyQuality <= 24 && '🔧 Середня'}
                {config.bodyQuality > 24 && config.bodyQuality <= 48 && '✨ Висока'}
                {config.bodyQuality > 48 && '💎 Ультра (найкраще)'}
              </div>
            </div>

            {/* Individual Toggles */}
            <div className="space-y-3">
              {/* Trails Toggle */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Шлейфи</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Сліди за організмами</span>
                </div>
                <button
                  onClick={() => toggle('showTrails')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showTrails ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showTrails ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Particles Toggle */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Частинки</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Фонові ефекти</span>
                </div>
                <button
                  onClick={() => toggle('showParticles')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showParticles ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showParticles ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Orbital Satellites Toggle */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Орбітальні Супутники</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">+100% FPS при вимкненні</span>
                </div>
                <button
                  onClick={() => toggle('showOrbitalSatellites')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showOrbitalSatellites ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showOrbitalSatellites ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Energy Glow Toggle */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Світіння Енергії</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Glow ефекти</span>
                </div>
                <button
                  onClick={() => toggle('showEnergyGlow')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showEnergyGlow ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showEnergyGlow ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
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
