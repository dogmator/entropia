import React from 'react';

import type { SimulationStats } from '@/types';

import { SpatialGrid, WorldGeometry, WorldStats, WorldZones } from './WorldComponents';

interface WorldTabProps {
    currentStats: SimulationStats;
}

export const WorldTab: React.FC<WorldTabProps> = ({ currentStats }) => {
    return (
        <div className="space-y-6">
            <WorldGeometry currentStats={currentStats} />
            <WorldZones currentStats={currentStats} />
            <SpatialGrid currentStats={currentStats} />
            <WorldStats currentStats={currentStats} />
        </div>
    );
};
