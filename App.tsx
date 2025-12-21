
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SimulationEngine } from './simulation/Engine';
import Viewport from './view/Viewport';
import Sidebar from './components/Sidebar';
import { SimulationStats } from './types';
import { UI_CONFIG } from './constants';

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
  const [history, setHistory] = useState<any[]>([]);
  const historyRef = useRef<any[]>([]);

  useEffect(() => {
    let tickCounter = 0;
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'TickUpdated') {
        setStats(event.stats);
        
        tickCounter++;
        if (tickCounter % Math.max(1, Math.floor(UI_CONFIG.updateFrequency / (speed > 1 ? speed : 1))) === 0) { 
          const newData = {
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] select-none font-sans text-white">
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
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 text-[9px] uppercase tracking-[0.3em] text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Наведіть на об'єкт для деталей
        </div>
      </div>
    </div>
  );
};

export default App;
