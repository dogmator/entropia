import React from 'react';

import type { SimulationStats } from '@/types';
import { useSimulation } from '@/ui/context/SimulationContext';

import { SpatialGrid, WorldGeometry, WorldStats, WorldZones } from './WorldComponents';

interface WorldTabProps {
    currentStats: SimulationStats;
}

export const WorldTab: React.FC<WorldTabProps> = ({ currentStats }) => {
    const { cameraState, worldScale } = useSimulation();
    return (
        <div className="space-y-6">
            <WorldGeometry currentStats={currentStats} cameraState={cameraState} worldScale={worldScale} />
            <WorldZones currentStats={currentStats} />
            <SpatialGrid currentStats={currentStats} />
            <WorldStats currentStats={currentStats} />
        </div>
    );
};
