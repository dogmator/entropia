
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { SimulationEngine } from './simulation/Engine';
import ErrorBoundary from './components/ErrorBoundary';
import { SimulationStats, PopulationDataPoint } from './types';
import { UI_CONFIG } from './constants';
import ViewportSkeleton from './components/skeletons/ViewportSkeleton';
import SidebarSkeleton from './components/skeletons/SidebarSkeleton';

// Lazy loading для важких компонентів
const Viewport = lazy(() => import('./view/Viewport'));
const Sidebar = lazy(() => import('./components/Sidebar'));

const App: React.FC = () => {
  const engine = useMemo(() => new SimulationEngine(), []);
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

  // Performance tracking
  const fpsCounter = useRef({ frames: 0, lastTime: performance.now(), fps: 60 });
  const tpsCounter = useRef({ ticks: 0, lastTime: performance.now(), tps: 60 });
  const frameTimestampRef = useRef(performance.now());

  // Завантаження налаштувань з localStorage
  useEffect(() => {
    const savedSpeed = localStorage.getItem('entropia-speed');
    if (savedSpeed) {
      const parsedSpeed = parseFloat(savedSpeed);
      // Підтримка діапазону 0-5
      setSpeed(Math.max(0, Math.min(5, parsedSpeed)));
    }
    // Симулюємо час завантаження для анімації
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Збереження швидкості в localStorage
  useEffect(() => {
    localStorage.setItem('entropia-speed', speed.toString());
  }, [speed]);

  useEffect(() => {
    let tickCounter = 0;
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'TickUpdated') {
        // Update FPS/TPS counters
        const now = performance.now();
        fpsCounter.current.frames++;
        tpsCounter.current.ticks++;

        const elapsedFps = now - fpsCounter.current.lastTime;
        const elapsedTps = now - tpsCounter.current.lastTime;

        if (elapsedFps >= 1000) {
          fpsCounter.current.fps = Math.round((fpsCounter.current.frames * 1000) / elapsedFps);
          fpsCounter.current.frames = 0;
          fpsCounter.current.lastTime = now;
        }

        if (elapsedTps >= 1000) {
          tpsCounter.current.tps = Math.round((tpsCounter.current.ticks * 1000) / elapsedTps);
          tpsCounter.current.ticks = 0;
          tpsCounter.current.lastTime = now;
        }

        const frameTime = now - frameTimestampRef.current;
        frameTimestampRef.current = now;

        // Add performance metrics to stats
        const statsWithPerformance: SimulationStats = {
          ...event.stats,
          performance: {
            fps: fpsCounter.current.fps,
            tps: tpsCounter.current.tps,
            frameTime: Number(frameTime.toFixed(2)),
            simulationTime: Number((event.deltaTime * 1000).toFixed(2)),
            entityCount: event.stats.preyCount + event.stats.predatorCount + event.stats.foodCount,
            drawCalls: 5, // prey + pred + food + obstacles + grid
          }
        };

        setStats(statsWithPerformance);

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
      // Hotkeys для швидкого перемикання швидкості
      if (e.key === ' ' || e.key === 'Space') {
        // Пробіл: переключення 0x <-> 1x
        setSpeed(prev => prev === 0 ? 1 : 0);
      } else if (e.key === '0') {
        setSpeed(0);
      } else if (e.key === '1') {
        setSpeed(1);
      } else if (e.key === '2') {
        setSpeed(2);
      } else if (e.key === '5') {
        setSpeed(5);
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
  }, []);

  const handleReset = () => {
    // Очистити localStorage
    localStorage.clear();

    // Скинути engine до дефолтних налаштувань
    engine.reset();

    // Очистити історію
    historyRef.current = [];
    setHistory([]);

    // Скинути швидкість до дефолту
    setSpeed(1);
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
          <Suspense
            fallback={
              <>
                <ViewportSkeleton />
                <SidebarSkeleton />
              </>
            }
          >
            <Viewport engine={engine} speed={speed} />

            <Sidebar
              engine={engine}
              stats={stats}
              history={history}
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
