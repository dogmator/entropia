
import React, { useState } from 'react';
import Dashboard from './Dashboard';
import SettingsPanel from './SettingsPanel';
import SimulationControls from './SimulationControls';
import { SimulationEngine } from '../simulation/Engine';
import { SimulationStats } from '../types';

interface SidebarProps {
  engine: SimulationEngine;
  stats: SimulationStats;
  history: any[];
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (val: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  engine, stats, history, isPaused, onTogglePause, onReset, speed, onSpeedChange 
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div 
      className={`fixed top-0 right-0 h-full z-20 transition-all duration-500 ease-in-out border-l border-white/10 flex ${
        isOpen ? 'w-[350px] max-w-[33vw]' : 'w-0'
      }`}
    >
      {/* Кнопка перемикання */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-1/2 -left-8 -translate-y-1/2 w-8 h-16 bg-black/60 backdrop-blur-md border border-r-0 border-white/10 rounded-l-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors pointer-events-auto"
      >
        <svg className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Контент сайдбару */}
      <div className={`w-full h-full bg-black/60 backdrop-blur-2xl flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex-shrink-0">
          <h1 className="text-xl font-black text-emerald-400 tracking-[0.2em] mb-1">EVOSIM 3D</h1>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-4">Еволюційна пісочниця</p>
        </div>

        <div className="space-y-6">
          <Dashboard stats={stats} history={history} />
          
          <SimulationControls 
            isPaused={isPaused} 
            onTogglePause={onTogglePause} 
            onReset={onReset}
            speed={speed}
            onSpeedChange={onSpeedChange}
          />

          <SettingsPanel engine={engine} />
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-[9px] text-gray-600 uppercase tracking-widest leading-loose">
          Керування камерою: миша + коліщатко<br/>
          Повний екран: [F]<br/>
          Пауза: [Space]<br/>
          Клік по організму: увімкнути шлейф
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
