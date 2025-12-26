import type { Food, Obstacle,Organism } from '../../simulation/Entity';
import { useSimulation } from '../context/SimulationContext';

export interface EntityHoverHook {
  hoveredEntity: Organism | Food | Obstacle | null;
  tooltipVisible: boolean;
  tooltipPos: { x: number; y: number };
}

export function useEntityHover(): EntityHoverHook {
  const { hoveredEntity, tooltipVisible, tooltipPos } = useSimulation();

  return {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
  };
}
