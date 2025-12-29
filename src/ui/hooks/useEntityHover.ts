import type { IEntityInfo } from '@/simulation/interfaces/ISimulationEngine';

import { useSimulation } from '../context/SimulationContext';

export interface EntityHoverHook {
  hoveredEntity: IEntityInfo | null;
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
