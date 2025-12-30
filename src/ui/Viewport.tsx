import { useEntityHover } from '@ui/hooks';
import React from 'react';

import { EntityType } from '@/types';
import { isFood, isObstacle, isOrganism } from '@ui/utils/EntityTypeGuards';
import { getStateColor, getStateLabel } from '@ui/utils/OrganismStateFormatters';

import { Entities } from './components/Entities';
import { Environment } from './components/Environment';
import { SceneContainer } from './components/SceneContainer';
import { Trails } from './components/Trails';
import { useSimulation } from './context/SimulationContext';

export const Viewport: React.FC = () => {
  const { engine, isLoading } = useSimulation();
  const {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
  } = useEntityHover();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-white bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-emerald-400 font-mono text-sm tracking-wider">INITIALIZING LINK...</div>
        </div>
      </div>
    );
  }


  const worldSize = engine.worldConfig?.WORLD_SIZE;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <SceneContainer worldSize={worldSize}>
        <Environment engine={engine} />
        <Entities engine={engine} />
        <Trails engine={engine} />
      </SceneContainer>

      {tooltipVisible ? <div
        className={`fixed pointer-events-none bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-[11px] z-50 shadow-2xl ring-1 ring-white/10 min-w-[200px] transition-opacity duration-[180ms] ${hoveredEntity ? 'opacity-100' : 'opacity-0'
          }`}
        style={{ left: tooltipPos.x + 20, top: tooltipPos.y + 20 }}
      >
        {isOrganism(hoveredEntity) ? (
          <div className="space-y-3">
            <div
              className={`font-black uppercase tracking-[0.2em] flex items-center gap-3 ${hoveredEntity.type === EntityType.PREY
                ? 'text-emerald-400'
                : 'text-red-400'
                }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] animate-pulse ${hoveredEntity.type === EntityType.PREY
                  ? 'bg-emerald-400'
                  : 'bg-red-400'
                  }`}
              />
              {hoveredEntity.type === EntityType.PREY
                ? 'Травоїдний'
                : 'Хижий'}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-gray-500 uppercase">Енергетичний запас</span>
                <span className="text-blue-400 font-bold">
                  {Math.round(hoveredEntity.energy ?? 0)}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all"
                  style={{
                    width: `${(hoveredEntity.normalizedEnergy ?? 0) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Поточний стан
              </span>
              <span
                className={`text-right font-bold ${getStateColor(
                  hoveredEntity.state
                )}`}
              >
                {getStateLabel(hoveredEntity.state)}
              </span>

              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Генерація
              </span>
              <span className="text-purple-400 text-right font-bold">
                #{hoveredEntity.genome?.generation ?? 0}
              </span>

              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Макс. швидкість
              </span>
              <span className="text-white text-right">
                {(hoveredEntity.genome?.maxSpeed ?? 0).toFixed(2)}
              </span>

              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Радіус сприйняття
              </span>
              <span className="text-white text-right">
                {Math.round(hoveredEntity.genome?.senseRadius ?? 0)}
              </span>

              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Хронологічний вік
              </span>
              <span className="text-white text-right">
                {hoveredEntity.age ?? 0}
              </span>

              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Візуальний шлейф
              </span>
              <span
                className={`${hoveredEntity.trailEnabled
                  ? 'text-emerald-400'
                  : 'text-gray-600'
                  } text-right font-bold`}
              >
                {hoveredEntity.trailEnabled ? 'АКТИВНО' : 'ДЕАКТИВОВАНО'}
              </span>
            </div>

            <div className="text-[9px] text-gray-500 italic text-center mt-2 border-t border-white/5 pt-2">
              Взаємодія для зміни стану шлейфу
            </div>
          </div>
        ) : isObstacle(hoveredEntity) ? (
          <div className="space-y-3">
            <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-purple-400">
              <div className="w-2.5 h-2.5 bg-purple-400 rounded-sm shadow-[0_0_10px_#a855f7]" />
              Просторова аномалія
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Радіус впливу
              </span>
              <span className="text-white text-right">
                {Math.round(hoveredEntity.radius)}
              </span>
            </div>
          </div>
        ) : isFood(hoveredEntity) ? (
          <div className="space-y-3">
            <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-yellow-400">
              <div className="w-2.5 h-2.5 bg-yellow-400 rotate-45 animate-spin shadow-[0_0_15px_#facc15]" />
              Енергетичний кристал
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
              <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                Енергетична цінність
              </span>
              <span className="text-yellow-400 font-bold text-right">
                +{hoveredEntity.energyValue}
              </span>
            </div>
          </div>
        ) : null}
      </div> : null}
    </div>
  );
};
