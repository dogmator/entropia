import { isFood } from '@ui/utils/EntityTypeGuards';
import { useCallback, useRef, useState } from 'react';

import { logger } from '@/core';
import type { IEntityInfo } from '@/shared/interfaces/IEntityInfo';

const logHoverEvent = (entity: IEntityInfo, previousEntity: IEntityInfo | null): void => {
    if (entity.id === previousEntity?.id && entity.type === previousEntity.type) return;

    const isFoodItem = isFood(entity);
    const isDead = 'isDead' in entity && (entity as { isDead?: boolean }).isDead === true;

    let source: string;
    if (isFoodItem) {
        source = 'Hover:Food';
    } else if (isDead) {
        source = 'Hover:DeadEntity';
    } else {
        source = 'Hover:Entity';
    }

    console.debug(`[Hover] ${entity.type} ID: ${entity.id} (Dead: ${String(isDead)})`);

    logger.info(`Hovered over ${entity.type} (ID: ${entity.id})`, source, {
        id: entity.id,
        type: entity.type,
        position: entity.position,
        isFood: isFoodItem,
        isDead
    });
};

export interface HoverState {
    hoveredEntity: IEntityInfo | null;
    setHoveredEntity: (entity: IEntityInfo | null) => void;
    isTooltipVisible: boolean;
    tooltipPos: { x: number; y: number };
    setTooltipPos: (pos: { x: number; y: number }) => void;
}

export const useHoverState = (): HoverState => {
    const [hoveredEntity, setHoveredEntityState] = useState<IEntityInfo | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const lastHoveredRef = useRef<IEntityInfo | null>(null);

    const setHoveredEntity = useCallback((entity: IEntityInfo | null) => {
        if (entity) logHoverEvent(entity, lastHoveredRef.current);
        lastHoveredRef.current = entity;
        setHoveredEntityState(entity);
    }, []);

    const isTooltipVisible = !!hoveredEntity;

    return { hoveredEntity, setHoveredEntity, isTooltipVisible, tooltipPos, setTooltipPos };
};
