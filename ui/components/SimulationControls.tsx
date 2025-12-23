
import React from 'react';

/**
 * Програмний інтерфейс для властивостей компонента SimulationControls.
 */
interface SimulationControlsProps {
  onReset: () => void;
  speed: number;
  onSpeedChange: (val: number) => void;
}

/**
 * Компонент SimulationControls — інтерфейс керування темпоральними параметрами симуляції.
 * Забезпечує регулювання швидкості плину часу та механізм реніціалізації стану світу.
 */
export const SimulationControls: React.FC<SimulationControlsProps> = ({
  onReset, speed, onSpeedChange
}) => {
  /**
   * Визначення колірної індикації та текстового статусу на основі поточної швидкості симуляції.
   */
  const getSpeedStatus = () => {
    if (speed === 0) {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        label: 'ЗУПИНЕНО',
        icon: '⏸️'
      };
    } else if (speed < 1) {
      return {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30',
        label: 'УПОВІЛЬНЕННЯ',
        icon: '🐢'
      };
    } else if (speed === 1) {
      return {
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        label: 'НОРМАЛЬНО',
        icon: '▶️'
      };
    } else {
      return {
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        label: 'ПРИСКОРЕННЯ',
        icon: '⚡'
      };
    }
  };

  const status = getSpeedStatus();

  /** Предетерміновані значення швидкості для швидкої навігації. */
  const quickButtons = [
    { value: 0, label: '0x', color: 'red' },
    { value: 0.5, label: '0.5x', color: 'yellow' },
    { value: 1, label: '1x', color: 'emerald' },
    { value: 2, label: '2x', color: 'blue' },
    { value: 5, label: '5x', color: 'purple' },
  ];

  return (
    <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
      {/* Заголовок з індикатором поточного стану часу */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[8px] uppercase tracking-[0.2em] text-gray-500 font-black">
            Темпоральний масштаб
          </span>
        </div>
        <div className={`flex items-center gap-2 ${status.bgColor} ${status.borderColor} border px-3 py-1.5 rounded-lg`}>
          <span className="text-sm">{status.icon}</span>
          <span className={`text-white font-mono text-sm font-bold`}>
            {speed.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Інформаційна панель статусу */}
      <div className={`${status.bgColor} ${status.borderColor} border rounded-lg px-3 py-2 text-center`}>
        <span className={`${status.color} text-[10px] font-black uppercase tracking-[0.25em]`}>
          {status.label}
        </span>
      </div>

      {/* Слайдер регулювання швидкості з орієнтирами */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          {/* Візуальні маркери шкали */}
          <div className="absolute -top-2 left-0 right-0 flex justify-between pointer-events-none px-0.5">
            {quickButtons.map((btn) => (
              <div key={btn.value} className="flex flex-col items-center">
                <div className={`w-0.5 h-2 ${speed === btn.value ? 'bg-white' : 'bg-white/30'}`} />
              </div>
            ))}
          </div>

          <input
            type="range"
            min={0} max={5.0} step={0.1}
            value={speed}
            onInput={(e: React.ChangeEvent<HTMLInputElement>) => onSpeedChange(parseFloat(e.target.value))}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 sm:h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:bg-white/20 transition-colors touch-manipulation"
            style={{
              background: `linear-gradient(to right,
                rgb(239 68 68) 0%,
                rgb(234 179 8) 20%,
                rgb(16 185 129) 40%,
                rgb(59 130 246) 60%,
                rgb(168 85 247) 100%)`
            }}
          />

          {/* Анотації до маркерів шкали */}
          <div className="flex justify-between text-[8px] sm:text-[7px] text-gray-500 font-bold mt-1">
            {quickButtons.map((btn) => (
              <span key={btn.value} className={speed === btn.value ? 'text-white' : ''}>
                {btn.label}
              </span>
            ))}
          </div>
        </div>

        {/* Панель швидкого перемикання дискретних значень */}
        <div className="grid grid-cols-5 gap-2">
          {quickButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onSpeedChange(btn.value)}
              className={`h-8 rounded-lg text-[10px] font-bold transition-all duration-200 touch-manipulation ${speed === btn.value
                  ? `bg-${btn.color}-500/30 text-${btn.color}-400 ring-2 ring-${btn.color}-500/50`
                  : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Функціональний елемент термінального скидання симуляції */}
      <button
        onClick={onReset}
        className="h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center gap-2 hover:bg-rose-500/20 hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] transition-all duration-300 border border-rose-500/20 hover:border-rose-500/40 touch-manipulation hover:scale-[1.02] active:scale-95 font-bold text-[11px] sm:text-[10px] uppercase tracking-widest"
        title="Скинути симуляційну модель"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Реініціалізувати Світ
      </button>
    </div>
  );
};
