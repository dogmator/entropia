import React, { useState } from 'react';

import { GRAPHICS_PRESETS } from '@/config';
import type { SimulationEngine } from '@/simulation';
import type { GraphicsQuality } from '@/types';

import { SettingsSlider } from './SettingsSlider';

/**
 * Програмний інтерфейс для властивостей компонента SettingsPanel.
 */
interface SettingsPanelProps {
  engine: SimulationEngine;
  worldScale: number;
  onWorldScaleChange: (val: number) => void;
}

/**
 * Компонент SettingsPanel — інтерфейс конфігурації параметрів симуляції та графічної підсистеми.
 * Забезпечує динамічне оновлення стану Engine через кастомізовані контролери (слайдери, перемикачі).
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine, worldScale, onWorldScaleChange }) => {
  const [config, setConfig] = useState(engine.config);
  const [collapsed, setCollapsed] = useState(false);

  /**
   * Оновлення числового параметра конфігурації з автоматичним переходом у режим «CUSTOM».
   */
  const update = <K extends keyof typeof config>(key: K, val: number) => {
    const newConfig = { ...config, [key]: val, graphicsQuality: 'CUSTOM' as const };
    setConfig(newConfig);
    // Детерміноване оновлення конфігурації об'єкта engine
    Object.assign(engine.config, { [key]: val, graphicsQuality: 'CUSTOM' });
  };

  /**
   * Інверсія логічного (boolean) параметра конфігурації.
   */
  const toggle = <K extends keyof typeof config>(key: K) => {
    const currentVal = config[key];
    if (typeof currentVal === 'boolean') {
      const newVal = !currentVal;
      const newConfig = { ...config, [key]: newVal, graphicsQuality: 'CUSTOM' as const };
      setConfig(newConfig);
      Object.assign(engine.config, { [key]: newVal, graphicsQuality: 'CUSTOM' });
    }
  };

  /**
   * Застосування пресету графічної якості до поточної конфігурації.
   */
  const applyPreset = (quality: GraphicsQuality) => {
    if (quality === 'CUSTOM') { return; }

    const preset = GRAPHICS_PRESETS[quality];
    const newConfig = {
      ...config,
      ...preset,
      graphicsQuality: quality,
    };
    setConfig(newConfig);
    Object.assign(engine.config, newConfig);
  };



  return (
    <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Заголовок панелі з функціоналом згортання */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 sm:px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-all duration-300 group border-b border-white/5 hover:border-emerald-500/20 touch-manipulation text-left bg-transparent"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 transition-all duration-300 ${collapsed ? '-rotate-90 scale-90 opacity-50' : 'rotate-0'}`}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div>
            <h2 className="text-[12px] sm:text-[11px] font-black text-white uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">
              Конфігуратор
            </h2>
            <div className="text-[8px] sm:text-[7px] text-gray-600 uppercase tracking-widest font-black -mt-0.5">Параметри середовища</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] sm:text-[9px] text-emerald-500/80 font-mono font-black px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">v2.5</span>
        </div>
      </button>

      {/* Контент панелі налаштувань */}
      <div className={`transition-all duration-500 ease-in-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[1600px] opacity-100'}`}>
        <div className="p-4 sm:p-5 space-y-9 overflow-y-auto custom-scrollbar max-h-[60vh]">

          {/* Секція 0: Глобальні параметри */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-purple-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-purple-500/20" />
              Космологія
              <div className="h-px flex-1 bg-purple-500/20" />
            </h3>
            <div className="group flex flex-col gap-1.5 mb-4 last:mb-0">
              <div className="flex justify-between items-center text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
                <span className="font-bold">Масштаб Світу</span>
                <span className="font-mono font-black text-white bg-white/5 px-2 py-0.5 rounded text-[10px] sm:text-[9px] min-w-[36px] text-center">
                  {worldScale.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={worldScale}
                onChange={(e) => onWorldScaleChange(parseFloat(e.target.value))}
                className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:bg-white/20 transition-all touch-manipulation"
              />
            </div>
          </section>

          {/* Секція 1: Фізика та системні параметри біосфери */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-emerald-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-emerald-500/20" />
              Біосфера
              <div className="h-px flex-1 bg-emerald-500/20" />
            </h3>
            <SettingsSlider label="Генерація їжі" param="foodSpawnRate" value={config.foodSpawnRate} min={0} max={1} step={0.05} onChange={update} />
            <SettingsSlider label="Ліміт ресурсів" param="maxFood" value={config.maxFood} min={50} max={2000} step={50} onChange={update} />
            <SettingsSlider label="Популяційний ліміт" param="maxOrganisms" value={config.maxOrganisms} min={10} max={1000} step={10} onChange={update} />

            <div className="flex justify-between items-center mb-4 mt-6">
              <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Аномалії середовища</span>
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

            <SettingsSlider label="Опір середовища" param="drag" value={config.drag} min={0.8} max={1.0} step={0.005} onChange={update} />
            <SettingsSlider label="Темп мутації" param="mutationFactor" value={config.mutationFactor} min={0.01} max={0.5} step={0.01} onChange={update} />
            <SettingsSlider label="Репродуктивний поріг" param="reproductionThreshold" value={config.reproductionThreshold} min={100} max={500} step={10} onChange={update} />
          </section>

          {/* Секція 2: Когнітивні моделі та інстинкти (Боїди) */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-blue-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-blue-500/20" />
              Інстинкти
              <div className="h-px flex-1 bg-blue-500/20" />
            </h3>
            <SettingsSlider label="Сепарація" param="separationWeight" value={config.separationWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
            <SettingsSlider label="Інтенсивність пошуку" param="seekWeight" value={config.seekWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
            <SettingsSlider label="Уникнення колізій" param="avoidWeight" value={config.avoidWeight} min={0} max={20} step={0.1} colorClass="accent-blue-500" onChange={update} />
          </section>

          {/* Секція 3: Параметри візуальної репрезентації */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-amber-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-amber-500/20" />
              Візуалізація
              <div className="h-px flex-1 bg-amber-500/20" />
            </h3>
            <SettingsSlider label="Прозорість тіл" param="organismOpacity" value={config.organismOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
            <SettingsSlider label="Масштаб тіл" param="organismScale" value={config.organismScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
            <SettingsSlider label="Прозорість ресурсів" param="foodOpacity" value={config.foodOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
            <SettingsSlider label="Масштаб ресурсів" param="foodScale" value={config.foodScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
            <SettingsSlider label="Координатна сітка" param="gridOpacity" value={config.gridOpacity} min={0.0} max={0.5} step={0.01} colorClass="accent-amber-500" onChange={update} />
          </section>

          {/* Секція 4: Графічні пресети та продуктивність */}
          <section>
            <h3 className="text-[10px] sm:text-[9px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-cyan-500/20" />
              ⚡ Графіка
              <div className="h-px flex-1 bg-cyan-500/20" />
            </h3>

            {/* Селектор пресетів якості */}
            <div className="mb-6">
              <div className="text-[10px] sm:text-[9px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Профіль якості</div>
              <div className="grid grid-cols-4 gap-2 mb-1">
                {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((quality) => (
                  <button
                    key={quality}
                    onClick={() => applyPreset(quality)}
                    className={`h-9 rounded-lg text-[9px] font-bold transition-all duration-200 touch-manipulation ${config.graphicsQuality === quality
                      ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                      }`}
                  >
                    {quality === 'LOW' ? '⚡ LOW' : null}
                    {quality === 'MEDIUM' ? '🔧 MED' : null}
                    {quality === 'HIGH' ? '✨ HIGH' : null}
                    {quality === 'ULTRA' ? '💎 ULTRA' : null}
                  </button>
                ))}
              </div>
              {config.graphicsQuality === 'CUSTOM' ? <div className="text-[8px] text-purple-400 text-center mt-1 uppercase tracking-wider">Кастомна конфігурація</div> : null}
            </div>

            {/* Регулятори окремих візуальних ефектів */}
            <div className="space-y-3">
              {/* Перемикач шлейфів руху */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Шлейфи</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Трасування траєкторій організмів</span>
                </div>
                <button
                  onClick={() => toggle('showTrails')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showTrails ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showTrails ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Перемикач фонових частинок */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Частинки</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Системи фонових мікро-ефектів</span>
                </div>
                <button
                  onClick={() => toggle('showParticles')}
                  className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${config.showParticles ? 'bg-cyan-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${config.showParticles ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Перемикач енергетичного сяйва */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Світіння</span>
                  <span className="text-[8px] sm:text-[7px] text-gray-600">Емісія енергетичних станів</span>
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

        {/* Футер панелі */}
        <div className="px-4 sm:px-5 py-3 bg-white/[0.02] border-t border-white/5 flex justify-center">
          <div className="text-[9px] sm:text-[8px] text-gray-600 font-black uppercase tracking-widest animate-pulse">
            Система активна • Моніторинг стабільний
          </div>
        </div>
      </div>
    </div>
  );
};
