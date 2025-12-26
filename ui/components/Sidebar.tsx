
import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './Dashboard';
import { SettingsPanel } from './SettingsPanel';
import { SimulationControls } from './SimulationControls';
import { DiagnosticsModal } from './DiagnosticsModal';
import { SimulationEngine } from '../../simulation/Engine';
import { SimulationStats, PopulationDataPoint } from '../../types';

import { useSimulation } from '../context/SimulationContext';

/**
 * Компонент Sidebar — основна вертикальна панель інтерфейсу користувача.
 * Забезпечує інтеграцію контролерів, статистичних панелей та налаштувань,
 * адаптуючись до різних типів дисплеїв та пристроїв введення.
 */
export const Sidebar: React.FC = () => {
  const {
    engine, stats, history, onReset, speed, setSpeed, worldScale, setWorldScale
  } = useSimulation();

  /**
   * Стан видимості панелі. Автоматично визначається згідно з пороговими значеннями ширини вікна.
   */
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Md breakpoint (Tailwind)
    }
    return true;
  });

  /**
   * Стан видимості діагностичного модального вікна.
   */
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  /** Референси для обробки сенсорних жестів на мобільних пристроях. */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /** Фіксація початкових координат сенсорного контакту. */
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    /** Верифікація жесту «swipe-to-close» для термінального закриття панелі. */
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = Math.abs(touchEndY - touchStartY.current);

      // Жест деактивації: горизонтальний зсув > 50px за умови мінімального вертикального дрейфу
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
      {/* Тіньова маска (Backdrop) для візуальної сегрегації мобільного контенту */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 md:hidden pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Основний контейнер бічної панелі */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full z-20 transition-all duration-500 ease-in-out border-l border-white/10 flex ${isOpen
          ? 'w-full sm:w-[400px] md:w-[380px] lg:w-[350px] lg:max-w-[33vw] xl:max-w-[420px]'
          : 'w-0'
          }`}
      >
        {/* Кнопка термінації сесії перегляду панелі (Мобільний режим) */}
        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 left-4 w-10 h-10 md:hidden bg-black/80 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors z-50 touch-manipulation shadow-lg"
            aria-label="Закрити інтерактивну панель"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Тригерний елемент перемикання стану видимості (Toggle) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute top-1/2 -left-10 md:-left-8 -translate-y-1/2 w-10 h-20 md:w-8 md:h-16 bg-black/60 backdrop-blur-md border border-r-0 border-white/10 rounded-l-xl flex items-center justify-center text-emerald-400 hover:text-white transition-colors pointer-events-auto touch-manipulation"
          aria-label={isOpen ? "Згорнути панель управління" : "Розгорнути панель управління"}
        >
          <svg className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Контейнер інтерактивного вмісту */}
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

            {/* Кнопка діагностики */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 group">
              <button
                onClick={() => setIsDiagnosticsOpen(true)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-purple-400 group-hover:text-purple-300 transition-colors">Диагностика</div>
                    <div className="text-xs text-gray-500">Мониторинг производительности</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 group-hover:text-purple-400 transition-colors">
                  {stats.performance?.fps || 0} FPS
                </div>
              </button>
            </div>
          </div>

          {/* Інформаційна довідка про маніпуляції та гарячі клавіші */}
          <div className="mt-8 pt-6 border-t border-white/5 text-[10px] sm:text-[9px] text-gray-600 uppercase tracking-widest leading-loose">
            Навігація камерою: маніпулятори миші + скролінґ<br />
            Повноекранний режим: [F]<br />
            Темпоральні профілі: [0] [1] [2] [5] або [Space]<br />
            Селекція суб'єкта: активація трекінг-шлейфу при натисканні
          </div>
        </div>
      </div>

      {/* Диагностическое модальное окно */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        currentStats={stats}
        performanceHistory={engine?.getPerformanceMonitor()?.getPerformanceHistory() || []}
        memoryStats={{
          usedJSHeapSize: engine?.getPerformanceMonitor()?.getMemoryStats()?.usedJSHeapSize || 0,
          totalJSHeapSize: engine?.getPerformanceMonitor()?.getMemoryStats()?.totalJSHeapSize || 0,
          jsHeapSizeLimit: engine?.getPerformanceMonitor()?.getMemoryStats()?.jsHeapSizeLimit || 0,
          used: engine?.getPerformanceMonitor()?.getMemoryStats()?.usedJSHeapSize || 0,
          total: engine?.getPerformanceMonitor()?.getMemoryStats()?.totalJSHeapSize || 0,
          limit: engine?.getPerformanceMonitor()?.getMemoryStats()?.jsHeapSizeLimit || 0
        }}
      />
    </>
  );
};
