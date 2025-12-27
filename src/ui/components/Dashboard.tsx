
import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { UI_THRESHOLDS } from '@/constants';
import type { PopulationDataPoint, SimulationStats } from '@/types';

/**
 * Програмний інтерфейс для властивостей компонента Dashboard.
 */
interface DashboardProps {
  stats: SimulationStats;
  history: PopulationDataPoint[];
}

/**
 * Компонент Dashboard — панель моніторингу та візуалізації метрик симуляції.
 * Забезпечує рендеринг основних кількісних показників та динаміку популяції.
 */
export const Dashboard: React.FC<DashboardProps> = ({ stats, history }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsMounted(true), 0);
  }, []);

  /**
   * Обчислення кольорової репрезентації ризику вимирання для візуальної сигналізації.
   */
  const extinctionColor = stats.extinctionRisk > UI_THRESHOLDS.EXTINCTION_RISK.CRITICAL
    ? 'text-red-500'
    : stats.extinctionRisk > UI_THRESHOLDS.EXTINCTION_RISK.HIGH
      ? 'text-yellow-400'
      : 'text-green-400';

  /**
   * Визначення колірної гами для індикатора частоти кадрів (FPS).
   */
  const fpsColor = (fps: number) => {
    if (fps >= UI_THRESHOLDS.FPS.HIGH) { return 'text-emerald-400'; }
    if (fps >= UI_THRESHOLDS.FPS.MEDIUM) { return 'text-yellow-400'; }
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Моніторинг системної продуктивності (Performance Monitor) */}
      {stats.performance ? <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 group">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[8px] sm:text-[7px] text-gray-500 uppercase tracking-widest font-black group-hover:text-blue-400 transition-colors">
            ⚡ Продуктивність
          </span>
          <span className={`text-lg sm:text-base font-mono font-black ${fpsColor(stats.performance.fps)} group-hover:drop-shadow-[0_0_8px_currentColor] transition-all`}>
            {stats.performance.fps} FPS
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[9px] sm:text-[8px]">
          <div className="bg-black/30 rounded-lg p-1.5 text-center">
            <div className="text-gray-500 uppercase tracking-tight mb-0.5">TPS</div>
            <div className="text-blue-400 font-mono font-bold">{stats.performance.tps}</div>
          </div>
          <div className="bg-black/30 rounded-lg p-1.5 text-center">
            <div className="text-gray-500 uppercase tracking-tight mb-0.5">Рендеринг</div>
            <div className="text-cyan-400 font-mono font-bold">{stats.performance.frameTime.toFixed(1)}ms</div>
          </div>
          <div className="bg-black/30 rounded-lg p-1.5 text-center">
            <div className="text-gray-500 uppercase tracking-tight mb-0.5">Об'єкти</div>
            <div className="text-purple-400 font-mono font-bold">{stats.performance.entityCount}</div>
          </div>
        </div>
      </div> : null}

      {/* Верифікатор критичного ризику вимирання */}
      {stats.extinctionRisk > UI_THRESHOLDS.EXTINCTION_RISK.WARNING ? <div className={`bg-red-950/30 border border-red-500/30 rounded-xl p-3 ${stats.extinctionRisk > UI_THRESHOLDS.EXTINCTION_RISK.CRITICAL ? 'animate-pulse' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] sm:text-[8px] text-red-400 uppercase tracking-widest font-black">Ризик вимирання</span>
          <span className={`text-xl sm:text-lg font-mono font-black ${extinctionColor}`}>
            {Math.round(stats.extinctionRisk * 100)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 transition-all duration-500"
            style={{ width: `${stats.extinctionRisk * 100}%` }}
          />
        </div>
      </div> : null}

      {/* Ієрархія основних кількісних показників */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Популяція травоїдних суб'єктів з метрикою енергобалансу */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all duration-300 hover:scale-[1.02] group cursor-pointer">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] sm:text-[7px] text-gray-500 uppercase tracking-widest font-black group-hover:text-green-400 transition-colors">Травоїдні</span>
          </div>
          <span className="text-xl sm:text-lg font-mono font-black text-green-400 group-hover:drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all">{stats.preyCount}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500/60 transition-all duration-300"
                style={{ width: `${Math.min(100, stats.avgPreyEnergy)}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[8px] text-green-400/60 font-mono">{Math.round(stats.avgPreyEnergy)}</span>
          </div>
        </div>

        {/* Популяція хижаків з метрикою метаболічної активності */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(248,113,113,0.15)] transition-all duration-300 hover:scale-[1.02] group cursor-pointer">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] sm:text-[7px] text-gray-500 uppercase tracking-widest font-black group-hover:text-red-400 transition-colors">Хижаки</span>
          </div>
          <span className="text-xl sm:text-lg font-mono font-black text-red-400 group-hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.5)] transition-all">{stats.predatorCount}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500/60 transition-all duration-300"
                style={{ width: `${Math.min(100, stats.avgPredatorEnergy)}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[8px] text-red-400/60 font-mono">{Math.round(stats.avgPredatorEnergy)}</span>
          </div>
        </div>

        {/* Ресурсна база (Кристали) */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 hover:border-yellow-500/30 hover:shadow-[0_0_20px_rgba(250,204,21,0.15)] transition-all duration-300 hover:scale-[1.02] group cursor-pointer">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] sm:text-[7px] text-gray-500 uppercase tracking-widest font-black group-hover:text-yellow-400 transition-colors">Кристали</span>
          </div>
          <span className="text-xl sm:text-lg font-mono font-black text-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] transition-all">{stats.foodCount}</span>
        </div>

        {/* Індекс еволюційної тяглості */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 hover:scale-[1.02] group cursor-pointer">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] sm:text-[7px] text-gray-500 uppercase tracking-widest font-black group-hover:text-purple-400 transition-colors">Макс. Покоління</span>
          </div>
          <span className="text-xl sm:text-lg font-mono font-black text-purple-400 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all">{stats.maxGeneration}</span>
        </div>
      </div>

      {/* Реєстратор життєвого циклу (Народження/Смерть) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="bg-emerald-950/20 rounded-lg p-2 border border-emerald-500/10 text-center hover:bg-emerald-950/40 hover:border-emerald-500/30 hover:scale-105 transition-all duration-300 cursor-pointer group">
          <span className="text-[8px] sm:text-[7px] text-emerald-400/60 uppercase tracking-widest block mb-1 group-hover:text-emerald-400 transition-colors">Народжень</span>
          <span className="text-base sm:text-sm font-mono font-bold text-emerald-400 group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.5)] transition-all">{stats.totalBirths}</span>
        </div>
        <div className="bg-gray-950/30 rounded-lg p-2 border border-gray-500/10 text-center hover:bg-gray-950/50 hover:border-gray-500/30 hover:scale-105 transition-all duration-300 cursor-pointer group">
          <span className="text-[8px] sm:text-[7px] text-gray-400/60 uppercase tracking-widest block mb-1 group-hover:text-gray-300 transition-colors">Смертей</span>
          <span className="text-base sm:text-sm font-mono font-bold text-gray-400 group-hover:text-gray-300 transition-all">{stats.totalDeaths}</span>
        </div>
        <div className="bg-purple-950/20 rounded-lg p-2 border border-purple-500/10 text-center col-span-2 sm:col-span-1 hover:bg-purple-950/40 hover:border-purple-500/30 hover:scale-105 transition-all duration-300 cursor-pointer group">
          <span className="text-[8px] sm:text-[7px] text-purple-400/60 uppercase tracking-widest block mb-1 group-hover:text-purple-400 transition-colors">Макс. Вік</span>
          <span className="text-base sm:text-sm font-mono font-bold text-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.5)] transition-all">{stats.maxAge}</span>
        </div>
      </div>

      {/* Візуалізація хронологічної динаміки популяції */}
      <div className="h-32 sm:h-36 lg:h-40 w-full bg-black/40 rounded-2xl overflow-hidden relative border border-white/5 p-4 group">
        <div className="absolute top-2 left-4 text-[8px] sm:text-[7px] text-gray-600 font-black uppercase tracking-[0.3em] z-10">Динаміка популяції</div>
        {isMounted ? <ResponsiveContainer width="100%" height="100%" debounce={UI_THRESHOLDS.DEBOUNCE_DELAY}>
          <LineChart data={history} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '12px', fontSize: '9px', color: '#fff' }}
              itemStyle={{ padding: '0px' }}
              labelStyle={{ display: 'none' }}
            />
            <Line name="Травоїдні" type="monotone" dataKey="prey" stroke="#4ade80" dot={false} strokeWidth={2.5} isAnimationActive={false} />
            <Line name="Хижаки" type="monotone" dataKey="pred" stroke="#f87171" dot={false} strokeWidth={2.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer> : null}
      </div>
    </div>
  );
};
