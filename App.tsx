
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { SimulationEngine } from './simulation/Engine';
import ErrorBoundary from './components/ErrorBoundary';
import { SimulationStats, PopulationDataPoint } from './types';
import { UI_CONFIG } from './constants';

// Lazy loading для важких компонентів
const Viewport = lazy(() => import('./view/Viewport'));
const Sidebar = lazy(() => import('./components/Sidebar'));

const App: React.FC = () => {
  const engine = useMemo(() => new SimulationEngine(), []);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Початковий стан статистики з усіма обов'язковими полями SimulationStats
  const [stats, setStats] = useState<SimulationStats>({
    preyCount: 0,
    predatorCount: 0,
    foodCount: 0,
    avgEnergy: 0,
    avgPreyEnergy: 0,
    avgPredatorEnergy: 0,
    generation: 0,
    maxGeneration: 0,
    maxAge: 0,
    totalDeaths: 0,
    totalBirths: 0,
    extinctionRisk: 0
  });
  const [history, setHistory] = useState<PopulationDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const historyRef = useRef<PopulationDataPoint[]>([]);

  // Завантаження налаштувань з localStorage
  useEffect(() => {
    const savedSpeed = localStorage.getItem('evosim-speed');
    if (savedSpeed) {
      setSpeed(parseFloat(savedSpeed));
    }
    // Симулюємо час завантаження для анімації
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Збереження швидкості в localStorage
  useEffect(() => {
    localStorage.setItem('evosim-speed', speed.toString());
  }, [speed]);

  useEffect(() => {
    let tickCounter = 0;
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'TickUpdated') {
        setStats(event.stats);

        tickCounter++;
        if (tickCounter % Math.max(1, Math.floor(UI_CONFIG.updateFrequency / (speed > 1 ? speed : 1))) === 0) {
          const newData: PopulationDataPoint = {
            time: tickCounter,
            prey: event.stats.preyCount,
            pred: event.stats.predatorCount
          };
          historyRef.current = [...historyRef.current, newData].slice(-UI_CONFIG.historyLength);
          setHistory([...historyRef.current]);
        }
      }
    });

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Space') {
          setIsPaused(prev => !prev);
        }
        if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [engine, speed]);

  const handleReset = () => {
    engine.reset();
    historyRef.current = [];
    setHistory([]);
  };

  return (
    <ErrorBoundary>
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] animate-fadeOut">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
            <div className="text-emerald-400 font-black uppercase tracking-[0.3em] text-sm animate-pulse">
              Ініціалізація симуляції...
            </div>
          </div>
        </div>
      )}

      <div className="relative w-screen h-screen overflow-hidden bg-[#050505] select-none font-sans text-white">
        <div className={`transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          <Suspense fallback={
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050505]">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
                <div className="text-emerald-400 font-black uppercase tracking-[0.3em] text-sm animate-pulse">
                  Завантаження модулів...
                </div>
              </div>
            </div>
          }>
            <Viewport engine={engine} isPaused={isPaused} speed={speed} />

            <Sidebar
              engine={engine}
              stats={stats}
              history={history}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
              onReset={handleReset}
              speed={speed}
              onSpeedChange={setSpeed}
            />

            <div className="absolute bottom-6 left-6 pointer-events-none z-10">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 text-[10px] sm:text-[9px] uppercase tracking-[0.3em] text-gray-400 transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                Наведіть на об'єкт для деталей
              </div>
            </div>
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
