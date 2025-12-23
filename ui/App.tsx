import React, { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ViewportSkeleton } from './components/skeletons/ViewportSkeleton';
import { SidebarSkeleton } from './components/skeletons/SidebarSkeleton';
import { SimulationProvider, useSimulation } from './context/SimulationContext';

/**
 * Динамічне завантаження важких компонентів для оптимізації первинного рендерингу (Code Splitting).
 */
const Viewport = lazy(() => import('./Viewport').then(m => ({ default: m.Viewport })));
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));

/**
 * Внутрішній компонент для рендерингу контенту, який має доступ до контексту
 */
const AppContent: React.FC = () => {
  const { isLoading } = useSimulation();

  return (
    <>
      {/* Інтерфейс ініціалізації (SplashScreen) */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] animate-fadeOut">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
            <div className="text-emerald-400 font-black uppercase tracking-[0.3em] text-sm animate-pulse">
              Кластерна ініціалізація...
            </div>
          </div>
        </div>
      )}

      <div className="relative w-screen h-screen overflow-hidden bg-[#050505] select-none font-sans text-white">
        <div className={`transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          <Suspense
            fallback={
              <>
                <ViewportSkeleton />
                <SidebarSkeleton />
              </>
            }
          >
            {/* Візуалізаційне ядро симуляції */}
            <Viewport />

            {/* Модальна панель управління та аналітики */}
            <Sidebar />

            {/* Контекстна довідка інтерфейсу */}
            <div className="absolute bottom-6 left-6 pointer-events-none z-10">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 text-[10px] sm:text-[9px] uppercase tracking-[0.3em] text-gray-400 transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                Селектуйте об'єкт для термінального аналізу
              </div>
            </div>
          </Suspense>
        </div>
      </div>
    </>
  );
};

/**
 * Кореневий компонент додатку Entropia 3D.
 * Виконує роль оркестратора симуляційного рушія, стану інтерфейсу та системних телеметрій.
 */
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <SimulationProvider>
        <AppContent />
      </SimulationProvider>
    </ErrorBoundary>
  );
};
