
import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './Dashboard';
import SettingsPanel from './SettingsPanel';
import SimulationControls from './SimulationControls';
import { SimulationEngine } from '../simulation/Engine';
import { SimulationStats, PopulationDataPoint } from '../types';

interface SidebarProps {
  engine: SimulationEngine;
  stats: SimulationStats;
  history: PopulationDataPoint[];
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (val: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  engine, stats, history, isPaused, onTogglePause, onReset, speed, onSpeedChange
}) => {
  // Автозгортання на мобільних пристроях
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // >= md breakpoint
    }
    return true;
  });

  // Swipe to close для мобільних
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = Math.abs(touchEndY - touchStartY.current);

      // Свайп вправо для закриття (мінімум 50px, вертикальний рух < 30px)
      if (deltaX > 50 && deltaY < 30 && isOpen) {
        setIsOpen(false);
      }
    };

    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart);
      sidebar.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (sidebar) {
        sidebar.removeEventListener('touchstart', handleTouchStart);
        sidebar.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop overlay для мобільних */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 md:hidden pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full z-20 transition-all duration-500 ease-in-out border-l border-white/10 flex ${
          isOpen
            ? 'w-full sm:w-[400px] md:w-[380px] lg:w-[350px] lg:max-w-[33vw] xl:max-w-[420px]'
            : 'w-0'
        }`}
      >
      {/* Кнопка закриття зверху для мобільних (portrait) */}
      {isOpen && (
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 left-4 w-10 h-10 md:hidden bg-black/80 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors z-50 touch-manipulation shadow-lg"
          aria-label="Закрити панель"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Кнопка перемикання (збоку) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-1/2 -left-10 md:-left-8 -translate-y-1/2 w-10 h-20 md:w-8 md:h-16 bg-black/60 backdrop-blur-md border border-r-0 border-white/10 rounded-l-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors pointer-events-auto touch-manipulation"
        aria-label={isOpen ? "Згорнути панель" : "Розгорнути панель"}
      >
        <svg className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Контент сайдбару */}
      <div className={`w-full h-full bg-black/60 backdrop-blur-2xl flex flex-col gap-6 p-4 sm:p-6 overflow-y-auto custom-scrollbar pointer-events-auto transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex-shrink-0">
          <h1 className="text-lg sm:text-xl font-black text-emerald-400 tracking-[0.2em] mb-1">EVOSIM 3D</h1>
          <p className="text-[10px] sm:text-[9px] text-gray-500 uppercase tracking-widest mb-4">Еволюційна пісочниця</p>
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

        <div className="mt-8 pt-6 border-t border-white/5 text-[10px] sm:text-[9px] text-gray-600 uppercase tracking-widest leading-loose">
          Керування камерою: миша + коліщатко<br/>
          Повний екран: [F]<br/>
          Пауза: [Space]<br/>
          Клік по організму: увімкнути шлейф
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
