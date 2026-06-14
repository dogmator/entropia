import { useEntityHover } from '@ui/hooks';
import { isFood, isObstacle, isOrganism } from '@ui/utils/EntityTypeGuards';
import { getStateColor, getStateLabel } from '@ui/utils/OrganismStateFormatters';
import React from 'react';

import { t } from '@/i18n';
import type { Food, Obstacle, Organism } from '@/simulation/Entity';
import { EntityType } from '@/types';

import { Entities } from './components/Entities';
import { Environment } from './components/Environment';
import { EvolutionPulse } from './components/EvolutionPulse';
import { GeneticCometTrail } from './components/GeneticCometTrail';
import { SceneContainer } from './components/SceneContainer';
import { Trails } from './components/Trails';
import { useSimulation } from './context/SimulationContext';

const TOOLTIP_OFFSET = 20;
const PERCENT_MULTIPLIER = 100;
const GENOME_FIELD_DECIMALS = 2;

// eslint-disable-next-line max-lines-per-function
const OrganismTooltip: React.FC<{ entity: Organism }> = ({ entity }) => {
  const isPrey = entity.type === EntityType.PREY;
  const colorClass = isPrey ? 'text-emerald-400' : 'text-red-400';
  const dotClass = isPrey ? 'bg-emerald-400' : 'bg-red-400';
  const label = isPrey ? t.entity.herbivoreType : t.entity.predatorType;

  return (
    <div className="space-y-3">
      <div className={`font-black uppercase tracking-[0.2em] flex items-center gap-3 ${colorClass}`}>
        <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] animate-pulse ${dotClass}`} />
        {label}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[9px]">
          <span className="text-gray-500 uppercase">{t.entity.energyReserve}</span>
          <span className="text-blue-400 font-bold">
            {Math.round(entity.energy)}
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all"
            style={{
              width: `${String(entity.normalizedEnergy * PERCENT_MULTIPLIER)}%`,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.currentState}</span>
        <span className={`text-right font-bold ${getStateColor(entity.state)}`}>
          {getStateLabel(entity.state)}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.stats.generation}</span>
        <span className="text-purple-400 text-right font-bold">
          #{entity.genome.generation}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.maxSpeed}</span>
        <span className="text-white text-right">
          {entity.genome.maxSpeed.toFixed(GENOME_FIELD_DECIMALS)}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.perceptionRadius}</span>
        <span className="text-white text-right">
          {Math.round(entity.genome.senseRadius)}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.chronologicalAge}</span>
        <span className="text-white text-right">{entity.age}</span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.currentRadius}</span>
        <span className="text-cyan-300 text-right font-bold">
          {entity.radius.toFixed(GENOME_FIELD_DECIMALS)}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.adultRadius}</span>
        <span className="text-cyan-500 text-right">
          {entity.adultRadius.toFixed(GENOME_FIELD_DECIMALS)}
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.growth}</span>
        <span className="text-emerald-300 text-right">
          {Math.round(entity.growthRatio * PERCENT_MULTIPLIER)}%
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.maturity}</span>
        <span className="text-indigo-300 text-right">
          {Math.round(entity.maturityRatio * PERCENT_MULTIPLIER)}%
        </span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.stuckTicks}</span>
        <span className="text-right text-orange-300">{entity.stuckTicks}</span>

        <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.trailStatus}</span>
        <span className={`${entity.trailEnabled ? 'text-emerald-400' : 'text-gray-600'} text-right font-bold`}>
          {entity.trailEnabled ? t.status.active : t.status.deactivated}
        </span>
      </div>

      <div className="text-[9px] text-gray-500 italic text-center mt-2 border-t border-white/5 pt-2">
        {t.entity.trailInteraction}
      </div>
    </div>
  );
};

const ObstacleTooltip: React.FC<{ entity: Obstacle }> = ({ entity }) => (
  <div className="space-y-3">
    <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-purple-400">
      <div className="w-2.5 h-2.5 bg-purple-400 rounded-sm shadow-[0_0_10px_#a855f7]" />
      {t.entity.spatialAnomaly}
    </div>
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
      <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.influenceRadius}</span>
      <span className="text-white text-right">{Math.round(entity.radius)}</span>
    </div>
  </div>
);

const FoodTooltip: React.FC<{ entity: Food }> = ({ entity }) => (
  <div className="space-y-3">
    <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-yellow-400">
      <div className="w-2.5 h-2.5 bg-yellow-400 rotate-45 animate-spin shadow-[0_0_15px_#facc15]" />
      {t.entity.energyCrystal}
    </div>
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
      <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.energyValue}</span>
      <span className="text-yellow-400 font-bold text-right">+{entity.energyValue}</span>

      <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.currentEnergy}</span>
      <span className="text-yellow-300 font-bold text-right">
        {Math.round(entity.currentEnergy)}
      </span>

      <span className="text-gray-500 uppercase tracking-tighter text-[9px]">{t.entity.crystalSize}</span>
      <span className="text-amber-200 text-right">
        {entity.radius.toFixed(GENOME_FIELD_DECIMALS)}
      </span>
    </div>
  </div>
);

const TooltipContent: React.FC<{ entity: NonNullable<ReturnType<typeof useEntityHover>['hoveredEntity']> }> = ({ entity }) => {
  if (isOrganism(entity)) return <OrganismTooltip entity={entity} />;
  if (isObstacle(entity)) return <ObstacleTooltip entity={entity} />;
  if (isFood(entity)) return <FoodTooltip entity={entity} />;
  return null;
};

export const Viewport: React.FC = () => {
  const { engine, isLoading } = useSimulation();
  const {
    hoveredEntity,
    isTooltipVisible,
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

  const worldSize = engine.worldConfig.WORLD_SIZE;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <SceneContainer worldSize={worldSize}>
        <Environment engine={engine} />
        <Entities />
        <EvolutionPulse engine={engine} />
        <GeneticCometTrail engine={engine} />
        <Trails engine={engine} />
      </SceneContainer>

      {isTooltipVisible ? (
        <div
          className={`fixed pointer-events-none bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-[11px] z-50 shadow-2xl ring-1 ring-white/10 min-w-[200px] transition-opacity duration-[180ms] ${hoveredEntity ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: tooltipPos.x + TOOLTIP_OFFSET, top: tooltipPos.y + TOOLTIP_OFFSET }}
        >
          {hoveredEntity && <TooltipContent entity={hoveredEntity} />}
        </div>
      ) : null}
    </div>
  );
};
