
import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { SimulationStats } from '../types';

interface DashboardProps {
  stats: SimulationStats;
  history: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ stats, history }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Обчислення ризику вимирання для візуалізації
  const extinctionColor = stats.extinctionRisk > 0.7
    ? 'text-red-500'
    : stats.extinctionRisk > 0.4
      ? 'text-yellow-400'
      : 'text-green-400';

  return (
    <div className="flex flex-col gap-6">
      {/* Індикатор ризику вимирання */}
      {stats.extinctionRisk > 0.3 && (
        <div className={`bg-red-950/30 border border-red-500/30 rounded-xl p-3 ${stats.extinctionRisk > 0.7 ? 'animate-pulse' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] text-red-400 uppercase tracking-widest font-black">Ризик вимирання</span>
            <span className={`text-lg font-mono font-black ${extinctionColor}`}>
              {Math.round(stats.extinctionRisk * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${stats.extinctionRisk * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Статистичні картки - основні */}
      <div className="grid grid-cols-2 gap-3">
        {/* Травоїдні з енергією */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black">Травоїдні</span>
          </div>
          <span className="text-lg font-mono font-black text-green-400">{stats.preyCount}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500/60 transition-all duration-300"
                style={{ width: `${Math.min(100, stats.avgPreyEnergy)}%` }}
              />
            </div>
            <span className="text-[8px] text-green-400/60 font-mono">{Math.round(stats.avgPreyEnergy)}</span>
          </div>
        </div>

        {/* Хижаки з енергією */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black">Хижаки</span>
          </div>
          <span className="text-lg font-mono font-black text-red-400">{stats.predatorCount}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500/60 transition-all duration-300"
                style={{ width: `${Math.min(100, stats.avgPredatorEnergy)}%` }}
              />
            </div>
            <span className="text-[8px] text-red-400/60 font-mono">{Math.round(stats.avgPredatorEnergy)}</span>
          </div>
        </div>

        {/* Кристали */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black">Кристали</span>
          </div>
          <span className="text-lg font-mono font-black text-yellow-400">{stats.foodCount}</span>
        </div>

        {/* Покоління */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black">Макс. Покоління</span>
          </div>
          <span className="text-lg font-mono font-black text-purple-400">{stats.maxGeneration}</span>
        </div>
      </div>

      {/* Статистика народжень/смертей */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-950/20 rounded-lg p-2 border border-emerald-500/10 text-center">
          <span className="text-[7px] text-emerald-400/60 uppercase tracking-widest block mb-1">Народжень</span>
          <span className="text-sm font-mono font-bold text-emerald-400">{stats.totalBirths}</span>
        </div>
        <div className="bg-gray-950/30 rounded-lg p-2 border border-gray-500/10 text-center">
          <span className="text-[7px] text-gray-400/60 uppercase tracking-widest block mb-1">Смертей</span>
          <span className="text-sm font-mono font-bold text-gray-400">{stats.totalDeaths}</span>
        </div>
        <div className="bg-purple-950/20 rounded-lg p-2 border border-purple-500/10 text-center">
          <span className="text-[7px] text-purple-400/60 uppercase tracking-widest block mb-1">Рекорд Віку</span>
          <span className="text-sm font-mono font-bold text-purple-400">{stats.maxAge}</span>
        </div>
      </div>

      {/* Графік популяції */}
      <div className="h-36 w-full bg-black/40 rounded-2xl overflow-hidden relative border border-white/5 p-4 group">
        <div className="absolute top-2 left-4 text-[7px] text-gray-600 font-black uppercase tracking-[0.3em] z-10">Динаміка популяції</div>
        {isMounted && (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
