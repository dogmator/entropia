
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

  return (
    <div className="flex flex-col gap-6">
      {/* Статистичні картки */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Травоїдні', value: stats.preyCount, color: 'text-green-400', icon: '🍃' },
          { label: 'Хижаки', value: stats.predatorCount, color: 'text-red-400', icon: '🦈' },
          { label: 'Кристали', value: stats.foodCount, color: 'text-yellow-400', icon: '✨' },
          { label: 'Сер. Енергія', value: Math.round(stats.avgEnergy), color: 'text-blue-400', icon: '🔋' },
          { label: 'Рекорд Віку', value: stats.maxAge, color: 'text-purple-400', icon: '👑' },
          { label: 'Усього Смертей', value: stats.totalDeaths, color: 'text-gray-400', icon: '💀' }
        ].map((item, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black block">{item.label}</span>
              <span className="text-[10px]">{item.icon}</span>
            </div>
            <span className={`text-lg font-mono font-black ${item.color}`}>{item.value}</span>
          </div>
        ))}
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
