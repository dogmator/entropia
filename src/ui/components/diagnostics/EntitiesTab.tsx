import React from 'react';

import { UI_THRESHOLDS } from '@/constants';
import type { SimulationStats } from '@/types';

import { MAX_PERCENTAGE, MetricCard } from './Shared';

interface EntitiesTabProps {
    currentStats: SimulationStats;
}

const PERCENTAGE_MULTIPLIER = 100;

const getExtinctionRiskColor = (risk: number) => {
    if (risk > UI_THRESHOLDS.EXTINCTION_RISK.CRITICAL) return 'text-red-400';
    if (risk > UI_THRESHOLDS.EXTINCTION_RISK.HIGH) return 'text-yellow-400';
    return 'text-emerald-400';
};

const PopulationStats = ({ currentStats, survivalRate }: { currentStats: SimulationStats, survivalRate: string }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Популяційна динаміка</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">Народжень загалом:</span>
                    <span className="text-emerald-400 font-mono">{currentStats.totalBirths}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Смертей загалом:</span>
                    <span className="text-red-400 font-mono">{currentStats.totalDeaths}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Макс. вік:</span>
                    <span className="text-purple-400 font-mono">{currentStats.maxAge}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">Макс. покоління:</span>
                    <span className="text-blue-400 font-mono">{currentStats.maxGeneration}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Середня енергія:</span>
                    <span className="text-yellow-400 font-mono">{currentStats.avgEnergy.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Коефіцієнт виживання:</span>
                    <span className="text-cyan-400 font-mono">
                        {survivalRate}%
                    </span>
                </div>
            </div>
        </div>
    </div>
);

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ currentStats }) => {
    const extinctionRiskColor = getExtinctionRiskColor(currentStats.extinctionRisk);

    const survivalRate = currentStats.totalBirths > 0
        ? ((currentStats.totalBirths - currentStats.totalDeaths) / currentStats.totalBirths * PERCENTAGE_MULTIPLIER).toFixed(1)
        : '0';

    return (
        <div className="space-y-6">
            {/* Entity Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Травоїдні"
                    value={currentStats.preyCount}
                    unit=""
                    color="text-emerald-400"
                    subtitle={`Середня енергія: ${currentStats.avgPreyEnergy.toFixed(1)}`}
                />
                <MetricCard
                    title="Хижаки"
                    value={currentStats.predatorCount}
                    unit=""
                    color="text-red-400"
                    subtitle={`Середня енергія: ${currentStats.avgPredatorEnergy.toFixed(1)}`}
                />
                <MetricCard
                    title="Ресурси"
                    value={currentStats.foodCount}
                    unit=""
                    color="text-yellow-400"
                />
                <MetricCard
                    title="Ризик вимирання"
                    value={Math.round(currentStats.extinctionRisk * PERCENTAGE_MULTIPLIER)}
                    unit="%"
                    color={extinctionRiskColor}
                    trend={currentStats.extinctionRisk * MAX_PERCENTAGE}
                />
            </div>

            {/* Population Dynamics */}
            <PopulationStats currentStats={currentStats} survivalRate={survivalRate} />
        </div>
    );
};
