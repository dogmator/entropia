
import React from 'react';

interface SimulationControlsProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (val: number) => void;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({ 
  isPaused, onTogglePause, onReset, speed, onSpeedChange 
}) => {
  return (
    <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onTogglePause}
          className={`flex-1 h-12 sm:h-10 rounded-lg flex items-center justify-center gap-2 transition-all font-bold text-[11px] sm:text-[10px] uppercase tracking-widest touch-manipulation ${
            isPaused 
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/20' 
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/20'
          }`}
        >
          {isPaused ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Продовжити
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              Пауза
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="w-12 h-12 sm:w-10 sm:h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center hover:bg-rose-500/20 transition-all border border-rose-500/20 touch-manipulation"
          title="Скинути симуляцію"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[9px] sm:text-[8px] uppercase tracking-[0.2em] text-gray-500 font-black">
          <span>Швидкість Часу</span>
          <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">{speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.1} max={5.0} step={0.1}
          value={speed}
          onInput={(e: any) => onSpeedChange(parseFloat(e.target.value))}
          onChange={(e: any) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-2 sm:h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:bg-white/20 transition-colors touch-manipulation"
        />
        <div className="flex justify-between text-[8px] sm:text-[7px] text-gray-600 font-bold uppercase mt-1">
          <span>Уповільнення</span>
          <span>Прискорення</span>
        </div>
      </div>
    </div>
  );
};

export default SimulationControls;
