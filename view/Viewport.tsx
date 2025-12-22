/**
 * Entropia 3D — Головний 3D Viewport (Рефакторена версія)
 *
 * Використовує custom hooks для чистої архітектури:
 * - useThreeScene - сцена, камера, renderer
 * - useSceneObjects - всі mesh об'єкти
 * - useParticleEffects - система частинок
 * - useEntityHover - hover та tooltip
 * - useSimulationEvents - події симуляції
 * - useAnimationLoop - головний цикл рендерингу
 */

import React, { useEffect, useState, useCallback } from 'react';
import { SimulationEngine } from '../simulation/Engine';
import { EntityType, OrganismState } from '../types';
import { Organism, Food, Obstacle } from '../simulation/Entity';
import { useThreeScene } from './hooks/useThreeScene';
import { useSceneObjects } from './hooks/useSceneObjects';
import { useParticleEffects } from './hooks/useParticleEffects';
import { useEntityHover } from './hooks/useEntityHover';
import { useSimulationEvents } from './hooks/useSimulationEvents';
import { useAnimationLoop } from './hooks/useAnimationLoop';

// ============================================================================
// ТИПИ
// ============================================================================

interface ViewportProps {
  engine: SimulationEngine;
  speed: number;
}

// ============================================================================
// ГОЛОВНИЙ КОМПОНЕНТ
// ============================================================================

const Viewport: React.FC<ViewportProps> = ({ engine, speed }) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // Callback ref для гарантованого отримання DOM елемента
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainer(node);
    }
  }, []);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const sceneData = useThreeScene(container);
  const sceneObjects = useSceneObjects(sceneData?.scene || null, engine, engine.config.bodyQuality);
  const particleEffects = useParticleEffects(sceneData?.scene || null);
  const {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
    onMouseMove,
    onClick,
    updateHoveredEntity,
  } = useEntityHover();

  useSimulationEvents(engine, particleEffects?.particleSystem || null);

  useAnimationLoop({
    speed,
    sceneData,
    sceneObjects,
    particleEffects,
    engine,
    updateHoveredEntity,
  });

  // ========================================================================
  // EVENT LISTENERS
  // ========================================================================

  useEffect(() => {
    if (!sceneData || !sceneObjects) return;

    const { camera, renderer } = sceneData;
    const { preyMesh, predMesh, foodMesh, idMaps } = sceneObjects;

    const handleClick = () => {
      onClick(camera, preyMesh, predMesh, foodMesh, idMaps, engine);
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
    };
  }, [sceneData, sceneObjects, onMouseMove, onClick, engine]);

  // ============================================================================
  // TOOLTIP UTILS
  // ============================================================================

  const isOrganism = (e: unknown): e is Organism =>
    e !== null &&
    typeof e === 'object' &&
    'type' in e &&
    (e.type === EntityType.PREY || e.type === EntityType.PREDATOR);
  const isObstacle = (e: unknown): e is Obstacle =>
    e !== null && typeof e === 'object' && 'type' in e && e.type === EntityType.OBSTACLE;
  const isFood = (e: unknown): e is Food =>
    e !== null && typeof e === 'object' && 'type' in e && e.type === EntityType.FOOD;

  const getStateLabel = (state: OrganismState): string => {
    const labels: Record<OrganismState, string> = {
      IDLE: 'Спокій',
      SEEKING: 'Пошук',
      FLEEING: 'Втеча',
      HUNTING: 'Полювання',
      REPRODUCING: 'Розмноження',
      DYING: 'Вмирає',
    };
    return labels[state] || state;
  };

  const getStateColor = (state: OrganismState): string => {
    const colors: Record<OrganismState, string> = {
      IDLE: 'text-gray-400',
      SEEKING: 'text-yellow-400',
      FLEEING: 'text-red-400',
      HUNTING: 'text-orange-400',
      REPRODUCING: 'text-pink-400',
      DYING: 'text-gray-600',
    };
    return colors[state] || 'text-gray-400';
  };

  // ============================================================================
  // РЕНДЕР UI
  // ============================================================================

  if (hoveredEntity && (import.meta as any).env?.DEV) {
    console.log('[Viewport] Hovered:', (hoveredEntity as any).id, 'isFood:', isFood(hoveredEntity));
  }

  return (
    <div ref={containerCallbackRef} className="w-full h-full relative overflow-hidden">
      {tooltipVisible && (
        <div
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
                  : 'Хижак'}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-gray-500">Енергія</span>
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
                  Стан
                </span>
                <span
                  className={`text-right font-bold ${getStateColor(
                    hoveredEntity.state
                  )}`}
                >
                  {getStateLabel(hoveredEntity.state)}
                </span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Покоління
                </span>
                <span className="text-purple-400 text-right font-bold">
                  #{hoveredEntity.genome?.generation ?? 0}
                </span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Швидкість
                </span>
                <span className="text-white text-right">
                  {(hoveredEntity.genome?.maxSpeed ?? 0).toFixed(2)}
                </span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Зір
                </span>
                <span className="text-white text-right">
                  {Math.round(hoveredEntity.genome?.senseRadius ?? 0)}
                </span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Вік
                </span>
                <span className="text-white text-right">
                  {hoveredEntity.age ?? 0}
                </span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Шлейф
                </span>
                <span
                  className={`${hoveredEntity.trailEnabled
                    ? 'text-emerald-400'
                    : 'text-gray-600'
                    } text-right font-bold`}
                >
                  {hoveredEntity.trailEnabled ? 'УВІМК' : 'ВИМК'}
                </span>
              </div>

              <div className="text-[9px] text-gray-500 italic text-center mt-2 border-t border-white/5 pt-2">
                Клікніть для перемикання шлейфу
              </div>
            </div>
          ) : isObstacle(hoveredEntity) ? (
            <div className="space-y-3">
              <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-purple-400">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-sm shadow-[0_0_10px_#a855f7]" />
                Аномалія
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Радіус
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
                Енергокристал
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
                  Поживність
                </span>
                <span className="text-yellow-400 font-bold text-right">
                  +{hoveredEntity.energyValue}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Viewport;
