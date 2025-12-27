/* eslint-disable simple-import-sort/imports */
import React, { useEffect, useRef, useState } from 'react';

import { Dashboard } from './Dashboard';
import { DiagnosticsModal } from './DiagnosticsModal';
import { SettingsPanel } from './SettingsPanel';
import { SimulationControls } from './SimulationControls';
import { Icons } from './shared/Icons';
import { UI_CONFIG } from '../../constants';
import { useSimulation } from '../context/SimulationContext';
import type { PopulationDataPoint, SimulationStats } from '@/types';
import { SimulationEngine } from '@/simulation';

const GESTURE = {
  THRESHOLD_X: 50,
  THRESHOLD_Y: 30,
};

/**
 * Компонент Sidebar — основна вертикальна панель інтерфейсу користувача.
 * Забезпечує інтеграцію контролерів, статистичних панелей та налаштувань,
 * адаптуючись до різних типів дисплеїв та пристроїв введення.
 */
const useSidebarGestures = (
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  sidebarRef: React.RefObject<HTMLDivElement | null>
) => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches[0]) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX.current;
        const deltaY = Math.abs(touchEndY - touchStartY.current);

        if (deltaX > GESTURE.THRESHOLD_X && deltaY < GESTURE.THRESHOLD_Y && isOpen) {
          setIsOpen(false);
        }
      }
    };

    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
      sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (sidebar) {
        sidebar.removeEventListener('touchstart', handleTouchStart);
        sidebar.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isOpen, setIsOpen, sidebarRef]);
};

/**
 * Компонент Sidebar — основна вертикальна панель інтерфейсу користувача.
 */
export const Sidebar: React.FC = () => {
  const {
    engine, stats, history, onReset, speed, setSpeed, worldScale, setWorldScale
  } = useSimulation();

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= UI_CONFIG.breakpoints.mobile;
    }
    return true;
  });

  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useSidebarGestures(isOpen, setIsOpen, sidebarRef);

  return (
    <>
      <SidebarOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full z-20 transition-all duration-500 ease-in-out border-l border-white/10 flex pointer-events-none ${isOpen
          ? 'w-full sm:w-[400px] md:w-[380px] lg:w-[350px] lg:max-w-[33vw] xl:max-w-[420px]'
          : 'w-0 border-transparent'
          }`}
      >
        <SidebarMobileClose isOpen={isOpen} onClose={() => setIsOpen(false)} />
        <SidebarToggle isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />

        <SidebarContent
          isOpen={isOpen}
          stats={stats}
          history={history}
          onReset={onReset}
          speed={speed}
          setSpeed={setSpeed}
          engine={engine}
          worldScale={worldScale}
          setWorldScale={setWorldScale}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        />
      </div>

      <SidebarDiagnostics
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        stats={stats}
        engine={engine}
      />
    </>
  );
};

const SidebarDiagnostics: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  stats: SimulationStats;
  engine: SimulationEngine;
}> = ({ isOpen, onClose, stats, engine }) => {
  const monitor = engine?.getPerformanceMonitor();
  if (!monitor) return null;

  const memory = monitor.getMemoryStats();
  if (!memory) return null;

  return (
    <DiagnosticsModal
      isOpen={isOpen}
      onClose={onClose}
      currentStats={stats}
      performanceHistory={monitor.getPerformanceHistory() || []}
      memoryStats={{
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }}
    />
  );
};

const SidebarOverlay: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => (
  isOpen ? <button
    type="button"
    className="fixed inset-0 w-full h-full bg-black/50 backdrop-blur-sm z-10 md:hidden cursor-pointer border-none p-0 m-0"
    onClick={onClose}
    aria-label="Close sidebar"
  /> : null
);

const SidebarMobileClose: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => (
  isOpen ? <button
    onClick={onClose}
    className="absolute top-4 left-4 w-10 h-10 md:hidden bg-black/80 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors z-50 touch-manipulation shadow-lg"
    aria-label="Закрити інтерактивну панель"
  >
    <Icons.Close strokeWidth={2.5} />
  </button> : null
);

const SidebarToggle: React.FC<{ isOpen: boolean, onToggle: () => void }> = ({ isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className="absolute top-1/2 -left-10 md:-left-8 -translate-y-1/2 w-10 h-20 md:w-8 md:h-16 bg-black/60 backdrop-blur-md border border-r-0 border-white/10 rounded-l-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors pointer-events-auto touch-manipulation"
    aria-label={isOpen ? "Згорнути панель управління" : "Розгорнути панель управління"}
  >
    <Icons.Back className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
  </button>
);

interface SidebarContentProps {
  isOpen: boolean;
  stats: SimulationStats;
  history: PopulationDataPoint[];
  onReset: () => void;
  speed: number;
  setSpeed: (v: number) => void;
  engine: SimulationEngine;
  worldScale: number;
  setWorldScale: (v: number) => void;
  onOpenDiagnostics: () => void;
}

/* eslint-disable react/prop-types */
const SidebarContent: React.FC<SidebarContentProps> = ({
  isOpen, stats, history, onReset, speed, setSpeed, engine, worldScale, setWorldScale, onOpenDiagnostics
}) => (
  <div className={`w-full h-full bg-black/60 backdrop-blur-2xl flex flex-col gap-6 p-4 sm:p-6 overflow-y-auto custom-scrollbar pointer-events-auto transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
    <div className="flex-shrink-0">
      <h1 className="text-lg sm:text-xl font-black text-emerald-400 tracking-[0.2em] mb-1">Entropia 3D</h1>
      <p className="text-[10px] sm:text-[9px] text-gray-500 uppercase tracking-widest mb-4">Еволюційна пісочниця</p>
    </div>

    <div className="space-y-6">
      <Dashboard stats={stats} history={history} />

      <SimulationControls
        onReset={onReset}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      <SettingsPanel
        engine={engine}
        worldScale={worldScale}
        onWorldScaleChange={setWorldScale}
      />

      <DiagnosticsButton
        onOpen={onOpenDiagnostics}
        fps={stats.performance?.fps || 0}
      />
    </div>

    <SidebarFooter />
  </div>
);

const DiagnosticsButton: React.FC<{ onOpen: () => void, fps: number }> = ({ onOpen, fps }) => (
  <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 group">
    <button
      onClick={onOpen}
      className="w-full flex items-center justify-between group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
          <Icons.Diagnostics />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-purple-400 group-hover:text-purple-300 transition-colors">Диагностика</div>
          <div className="text-xs text-gray-500">Мониторинг производительности</div>
        </div>
      </div>
      <div className="text-xs text-gray-400 group-hover:text-purple-400 transition-colors">
        {fps} FPS
      </div>
    </button>
  </div>
);

const SidebarFooter: React.FC = () => (
  <div className="mt-8 pt-6 border-t border-white/5 text-[10px] sm:text-[9px] text-gray-600 uppercase tracking-widest leading-loose">
    Навігація камерою: маніпулятори миші + скролінґ<br />
    Повноекранний режим: [F]<br />
    Темпоральні профілі: [0] [1] [2] [5] або [Space]<br />
    Селекція суб&apos;єкта: активація трекінг-шлейфу при натисканні
  </div>
);
