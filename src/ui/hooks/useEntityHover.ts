import type { IEntityInfo } from '@/shared/interfaces/IEntityInfo';

import { useSimulation } from '../context/SimulationContext';

export interface EntityHoverHook {
  hoveredEntity: IEntityInfo | null;
  isTooltipVisible: boolean;
  tooltipPos: { x: number; y: number };
}

export function useEntityHover(): EntityHoverHook {
  const { hoveredEntity, isTooltipVisible, tooltipPos } = useSimulation();

  return {
    hoveredEntity,
    isTooltipVisible,
    tooltipPos,
  };
}
