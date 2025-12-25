/**
 * Entropia 3D — Центральний компонент візуалізації тривимірного простору (рефакторизована версія 2.0).
 *
 * ОПТИМІЗАЦІЇ:
 * ✓ Екстракція type guards у окремий модуль (EntityTypeGuards.ts)
 * ✓ Екстракція форматерів стану у OrganismStateFormatters.ts
 * ✓ Використання useMemo/useCallback для мемоізації
 * ✓ Елімінація типу 'any' через discriminated unions
 * ✓ Використання конфігураційних констант з RenderConfig
 * ✓ Розділення Tooltip у окремий компонент для реюзабельності
 *
 * Архітектура базується на принципах:
 * - Separation of Concerns (SoC)
 * - Single Responsibility Principle (SRP)
 * - Don't Repeat Yourself (DRY)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSimulation } from './context/SimulationContext';
import { useThreeScene } from './hooks/useThreeScene';
import { useSceneObjects } from './hooks/useSceneObjects';
import { useParticleEffects } from './hooks/useParticleEffects';
import { useEntityHover } from './hooks/useEntityHover.refactored';
import { useSimulationEvents } from './hooks/useSimulationEvents';
import { useAnimationLoop } from './hooks/useAnimationLoop.refactored';
import { isOrganism, isFood, isObstacle } from './utils/EntityTypeGuards';
import { getStateLabel, getStateColor } from './utils/OrganismStateFormatters';
import { TOOLTIP_CONFIG } from './config/RenderConfig';
import { EntityType } from '../types';
import { Organism, Food, Obstacle } from '../simulation/Entity';

// ============================================================================
// КОМПОНЕНТ TOOLTIP (ІНФОРМАЦІЙНЕ ВІКНО)
// ============================================================================

interface EntityTooltipProps {
  entity: Organism | Food | Obstacle | null;
  visible: boolean;
  position: { x: number; y: number };
}

/**
 * Компонент відображення інформаційного вікна для сутностей.
 * Мемоізований для запобігання зайвим рендерам.
 */
const EntityTooltip = React.memo<EntityTooltipProps>(
  ({ entity, visible, position }) => {
    if (!visible || !entity) return null;

    const tooltipStyle: React.CSSProperties = {
      left: position.x + TOOLTIP_CONFIG.offsetX,
      top: position.y + TOOLTIP_CONFIG.offsetY,
    };

    return (
      <div
        className={`fixed pointer-events-none bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-[11px] z-50 shadow-2xl ring-1 ring-white/10 min-w-[200px] transition-opacity duration-[${TOOLTIP_CONFIG.fadeOutDelay}ms] ${
          entity ? 'opacity-100' : 'opacity-0'
        }`}
        style={tooltipStyle}
      >
        {isOrganism(entity) ? (
          <OrganismTooltipContent organism={entity} />
        ) : isObstacle(entity) ? (
          <ObstacleTooltipContent obstacle={entity} />
        ) : isFood(entity) ? (
          <FoodTooltipContent food={entity} />
        ) : null}
      </div>
    );
  }
);

EntityTooltip.displayName = 'EntityTooltip';

// ============================================================================
// КОМПОНЕНТИ ВМІСТУ TOOLTIP ДЛЯ РІЗНИХ ТИПІВ СУТНОСТЕЙ
// ============================================================================

/**
 * Вміст tooltip для організмів.
 */
const OrganismTooltipContent: React.FC<{ organism: Organism }> = React.memo(
  ({ organism }) => {
    const isPrey = organism.type === EntityType.PREY;
    const typeColor = isPrey ? 'text-emerald-400' : 'text-red-400';
    const typeBgColor = isPrey ? 'bg-emerald-400' : 'bg-red-400';
    const typeLabel = isPrey ? 'Травоїдний' : 'Хижий';

    return (
      <div className="space-y-3">
        <div
          className={`font-black uppercase tracking-[0.2em] flex items-center gap-3 ${typeColor}`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] animate-pulse ${typeBgColor}`}
          />
          {typeLabel}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500 uppercase">Енергетичний запас</span>
            <span className="text-blue-400 font-bold">
              {Math.round(organism.energy ?? 0)}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all"
              style={{
                width: `${(organism.normalizedEnergy ?? 0) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Поточний стан
          </span>
          <span
            className={`text-right font-bold ${getStateColor(organism.state)}`}
          >
            {getStateLabel(organism.state)}
          </span>

          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Генерація
          </span>
          <span className="text-purple-400 text-right font-bold">
            #{organism.genome?.generation ?? 0}
          </span>

          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Макс. швидкість
          </span>
          <span className="text-white text-right">
            {(organism.genome?.maxSpeed ?? 0).toFixed(2)}
          </span>

          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Радіус сприйняття
          </span>
          <span className="text-white text-right">
            {Math.round(organism.genome?.senseRadius ?? 0)}
          </span>

          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Хронологічний вік
          </span>
          <span className="text-white text-right">{organism.age ?? 0}</span>

          <span className="text-gray-500 uppercase tracking-tighter text-[9px]">
            Візуальний шлейф
          </span>
          <span
            className={`${
              organism.trailEnabled ? 'text-emerald-400' : 'text-gray-600'
            } text-right font-bold`}
          >
            {organism.trailEnabled ? 'АКТИВНО' : 'ДЕАКТИВОВАНО'}
          </span>
        </div>

        <div className="text-[9px] text-gray-500 italic text-center mt-2 border-t border-white/5 pt-2">
          Взаємодія для зміни стану шлейфу
        </div>
      </div>
    );
  }
);

OrganismTooltipContent.displayName = 'OrganismTooltipContent';

/**
 * Вміст tooltip для перешкод.
 */
const ObstacleTooltipContent: React.FC<{ obstacle: Obstacle }> = React.memo(
  ({ obstacle }) => (
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
          {Math.round(obstacle.radius)}
        </span>
      </div>
    </div>
  )
);

ObstacleTooltipContent.displayName = 'ObstacleTooltipContent';

/**
 * Вміст tooltip для їжі.
 */
const FoodTooltipContent: React.FC<{ food: Food }> = React.memo(({ food }) => (
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
        +{food.energyValue}
      </span>
    </div>
  </div>
));

FoodTooltipContent.displayName = 'FoodTooltipContent';

// ============================================================================
// ОСНОВНИЙ КОМПОНЕНТ VIEWPORT
// ============================================================================

export const Viewport: React.FC = () => {
  const { engine, speed } = useSimulation();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  /**
   * Функція зворотного виклику для детермінованого отримання посилання на DOM-елемент контейнера.
   * Мемоізована для запобігання рекреації.
   */
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainer(node);
    }
  }, []);

  // ========================================================================
  // ІНІЦІАЛІЗАЦІЯ СПЕЦІАЛІЗОВАНИХ ХУКІВ
  // ========================================================================

  const worldSize = useMemo(
    () => engine.worldConfig?.WORLD_SIZE,
    [engine.worldConfig?.WORLD_SIZE]
  );

  const sceneData = useThreeScene(container, worldSize);
  const sceneObjects = useSceneObjects(sceneData?.scene ?? null, engine);
  const particleEffects = useParticleEffects(sceneData?.scene ?? null);

  const {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
    onMouseMove,
    onClick,
    updateHoveredEntity,
  } = useEntityHover();

  useSimulationEvents(engine, particleEffects?.particleSystem ?? null);

  useAnimationLoop({
    speed,
    sceneData,
    sceneObjects,
    particleEffects,
    engine,
    updateHoveredEntity,
  });

  // ========================================================================
  // КОНФІГУРАЦІЯ ТА РЕЄСТРАЦІЯ ОБРОБНИКІВ ПОДІЙ
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

  // ========================================================================
  // ВІЗУАЛІЗАЦІЯ ПРЕДСТАВНИЦЬКОГО ШАРУ
  // ========================================================================

  return (
    <div
      ref={containerCallbackRef}
      className="w-full h-full relative overflow-hidden"
    >
      <EntityTooltip
        entity={hoveredEntity}
        visible={tooltipVisible}
        position={tooltipPos}
      />
    </div>
  );
};
