
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, PropsWithChildren } from 'react';
import { SimulationEngine } from '../../simulation/Engine';
import { SimulationStats, PopulationDataPoint } from '../../types';
import { UI_CONFIG } from '../../constants';

interface SimulationContextValue {
    engine: SimulationEngine;
    stats: SimulationStats;
    history: PopulationDataPoint[];
    speed: number;
    setSpeed: (val: number | ((prev: number) => number)) => void;
    worldScale: number;
    setWorldScale: (val: number) => void;
    isLoading: boolean;
    onReset: () => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (!context) {
        throw new Error('useSimulation must be used within a SimulationProvider');
    }
    return context;
};

export const SimulationProvider: React.FC<PropsWithChildren> = ({ children }) => {
    /** Масштабний коефіцієнт світу (0.5x - 10.0x). */
    const [worldScale, setWorldScale] = useState(1.0);

    /** Ініціалізація та мемоїзація екземпляра симуляційного рушія. */
    const engine = useMemo(() => new SimulationEngine(worldScale), [worldScale]);

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
        const savedScale = localStorage.getItem('entropia-scale');
        if (savedScale) {
            const parsedScale = parseFloat(savedScale);
            setWorldScale(Math.max(0.1, Math.min(10, parsedScale)));
        }
        // Імітація латентності завантажувача для забезпечення візуальної плавності переходів.
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    /** Синхронізація темпоральних параметрів із персистентним сховищем. */
    useEffect(() => {
        localStorage.setItem('entropia-speed', speed.toString());
        localStorage.setItem('entropia-scale', worldScale.toString());
    }, [speed, worldScale]);

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
    const onReset = () => {
        localStorage.clear();
        engine.reset();
        historyRef.current = [];
        setHistory([]);
    };

    const value = {
        engine,
        stats,
        history,
        speed,
        setSpeed,
        worldScale,
        setWorldScale,
        isLoading,
        onReset
    };

    return (
        <SimulationContext.Provider value={value}>
            {children}
        </SimulationContext.Provider>
    );
};
