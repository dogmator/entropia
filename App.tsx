
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { SimulationEngine } from './simulation/Engine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SimulationStats, PopulationDataPoint } from './types';
import { UI_CONFIG } from './constants';
import { ViewportSkeleton } from './components/skeletons/ViewportSkeleton';
import { SidebarSkeleton } from './components/skeletons/SidebarSkeleton';

/**
 * Динамічне завантаження важких компонентів для оптимізації первинного рендерингу (Code Splitting).
 */
const Viewport = lazy(() => import('./view/Viewport').then(m => ({ default: m.Viewport })));
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));

/**
 * Кореневий компонент додатку Entropia 3D.
 * Виконує роль оркестратора симуляційного рушія, стану інтерфейсу та системних телеметрій.
 */
export const App: React.FC = () => {
  /** Ініціалізація та мемоїзація екземпляра симуляційного рушія. */
  const engine = useMemo(() => new SimulationEngine(), []);

  /** Темпоральний масштаб симуляції (0x - 5x). */
  const [speed, setSpeed] = useState(1);

  /** Агрегована статистика симуляційного процесу. */
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

  /** Хронологічний реєстр популяційної динаміки для візуалізації графіків. */
  const [history, setHistory] = useState<PopulationDataPoint[]>([]);

  /** Стан ініціалізації середовища. */
  const [isLoading, setIsLoading] = useState(true);

  /** Референс для зберігання історії без тригера рендерингу. */
  const historyRef = useRef<PopulationDataPoint[]>([]);

  /** Метрики продуктивності системного рендерингу та логіки. */
  const fpsCounter = useRef({ frames: 0, lastTime: performance.now(), fps: 60 });
  const tpsCounter = useRef({ ticks: 0, lastTime: performance.now(), tps: 60 });
  const frameTimestampRef = useRef(performance.now());

  /** Ефект десеріалізації налаштувань користувача із локального сховища. */
  useEffect(() => {
    const savedSpeed = localStorage.getItem('entropia-speed');
    if (savedSpeed) {
      const parsedSpeed = parseFloat(savedSpeed);
      setSpeed(Math.max(0, Math.min(5, parsedSpeed)));
    }
    // Імітація латентності завантажувача для забезпечення візуальної плавності переходів.
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  /** Синхронізація темпоральних параметрів із персистентним сховищем. */
  useEffect(() => {
    localStorage.setItem('entropia-speed', speed.toString());
  }, [speed]);

  /** Реєстрація підписки на події симуляційного рушія та обробка системних подій. */
  useEffect(() => {
    let tickCounter = 0;
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'TickUpdated') {
        const now = performance.now();
        fpsCounter.current.frames++;
        tpsCounter.current.ticks++;

        const elapsedFps = now - fpsCounter.current.lastTime;
        const elapsedTps = now - tpsCounter.current.lastTime;

        // Обчислення частоти кадрів (FPS)
        if (elapsedFps >= 1000) {
          fpsCounter.current.fps = Math.round((fpsCounter.current.frames * 1000) / elapsedFps);
          fpsCounter.current.frames = 0;
          fpsCounter.current.lastTime = now;
        }

        // Обчислення частоти обробки логіки (TPS)
        if (elapsedTps >= 1000) {
          tpsCounter.current.tps = Math.round((tpsCounter.current.ticks * 1000) / elapsedTps);
          tpsCounter.current.ticks = 0;
          tpsCounter.current.lastTime = now;
        }

        const frameTime = now - frameTimestampRef.current;
        frameTimestampRef.current = now;

        /** Формування розширеного об'єкта статистики з метриками продуктивності. */
        const statsWithPerformance: SimulationStats = {
          ...event.stats,
          performance: {
            fps: fpsCounter.current.fps,
            tps: tpsCounter.current.tps,
            frameTime: Number(frameTime.toFixed(2)),
            simulationTime: Number((event.deltaTime * 1000).toFixed(2)),
            entityCount: event.stats.preyCount + event.stats.predatorCount + event.stats.foodCount,
            drawCalls: 5, // Базові категорії об'єктів
          }
        };

        setStats(statsWithPerformance);

        tickCounter++;
        /** Дискретизація оновлення історії популяції згідно з конфігурацією інтерфейсу. */
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

    /** Делегування обробки глобальних подій клавіатури (Hotkeys). */
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') {
        // Space/Пробіл: тригерний перемикач Пауза/Нормальна швидкість
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

      // Перемикання повноекранного режиму (F)
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
      unsubscribe();
    };
  }, [engine, speed]);

  /** Реніціалізація системного стану та очищення локальних даних. */
  const handleReset = () => {
    localStorage.clear();
    engine.reset();
    historyRef.current = [];
    setHistory([]);
    setSpeed(1);
  };

  return (
    <ErrorBoundary>
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
            <Viewport engine={engine} speed={speed} />

            {/* Модальна панель управління та аналітики */}
            <Sidebar
              engine={engine}
              stats={stats}
              history={history}
              onReset={handleReset}
              speed={speed}
              onSpeedChange={setSpeed}
            />

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
    </ErrorBoundary>
  );
};
