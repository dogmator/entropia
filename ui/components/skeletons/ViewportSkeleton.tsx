/**
 * Скелетний люмінесцентний завантажувач для модуля Viewport (Skeleton Loader).
 *
 * Використовується як інерційний заповнювач під час асинхронної ініціалізації (lazy loading) компонента Viewport.
 * Репродукує базову геометрію 3D-простору з використанням анімованих градієнтів для мінімізації когнітивного навантаження.
 */

import React from 'react';

export const ViewportSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#020205]">
      {/* Скелетна апроксимація космічного фону */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 via-purple-900/5 to-pink-900/5 animate-pulse" />

      {/* Центральна сигнатура стану ініціалізації */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          {/* Геометричний примітив (куб) у дротяному представленні */}
          <div className="relative w-24 h-24">
            {/* Багатошарова скелетна структура */}
            <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-lg animate-pulse" />
            <div className="absolute inset-2 border-2 border-emerald-500/30 rounded-lg animate-pulse delay-75" />
            <div className="absolute inset-4 border-2 border-emerald-500/40 rounded-lg animate-pulse delay-150" />

            {/* Ротаційна емісія світла */}
            <div
              className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/10 to-transparent animate-spin"
              style={{ animationDuration: '3s' }}
            />
          </div>

          {/* Вербальний індикатор прогресу */}
          <div className="text-emerald-400/60 font-black uppercase tracking-[0.3em] text-sm animate-pulse">
            Ініціалізація 3D-середовища...
          </div>
        </div>
      </div>

      {/* Декоративна просторова сітка (абстракція) */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Нижній композиційний заповнювач інтерфейсу */}
      <div className="absolute bottom-6 left-6 z-10">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 animate-pulse">
          <div className="w-24 h-3 bg-gray-700/50 rounded" />
        </div>
      </div>
    </div>
  );
};
