import React from 'react';

import { DIAGNOSTICS_CONFIG, RENDER } from '@/config';
import { PerformanceHelpers } from '@/core/utils/PerformanceUtils';
import type { PerformanceMetrics, SimulationStats } from '@/types';

import { MAX_PERCENTAGE, MetricCard, PerformanceChart } from './Shared';

interface PerformanceTabProps {
    currentStats: SimulationStats;
    performanceHistory: PerformanceMetrics[];
}

const CHART_DISPLAY_DIVISOR = 2;
const MS_PER_SEC = 1000;

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ currentStats, performanceHistory }) => {
    const getFPSColor = PerformanceHelpers.color.getFPSColor;
    const getTPSColor = PerformanceHelpers.color.getTPSColor;
    const getFrameTimeColor = PerformanceHelpers.color.getFrameTimeColor;

    // Use a subset of history for cleaner charts if needed, or full history
    const chartData = performanceHistory.slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH / CHART_DISPLAY_DIVISOR);

    const perf = currentStats.performance;
    const fps = perf?.fps || 0;
    const tps = perf?.tps || 0;
    const frameTime = perf?.frameTime || 0;
    const entityCount = perf?.entityCount || 0;

    const fpsTrend = Math.min(MAX_PERCENTAGE, fps / RENDER.targetFPS * MAX_PERCENTAGE);
    const tpsTrend = Math.min(MAX_PERCENTAGE, tps / RENDER.targetFPS * MAX_PERCENTAGE);
    const frameTimeTrend = Math.min(MAX_PERCENTAGE, frameTime / (MS_PER_SEC / RENDER.targetFPS) * MAX_PERCENTAGE);

    return (
        <div className="space-y-6">
            {/* Real-time Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="FPS"
                    value={fps}
                    unit=""
                    color={getFPSColor(fps)}
                    trend={fpsTrend}
                />
                <MetricCard
                    title="TPS"
                    value={tps}
                    unit=""
                    color={getTPSColor(tps)}
                    trend={tpsTrend}
                />
                <MetricCard
                    title="Frame Time"
                    value={parseFloat(frameTime.toFixed(1))}
                    unit="ms"
                    color={getFrameTimeColor(frameTime)}
                    trend={frameTimeTrend}
                />
                <MetricCard
                    title="Entities"
                    value={entityCount}
                    unit=""
                    color="text-purple-400"
                />
            </div>

            {/* Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceChart
                    title="FPS/TPS Dynamics"
                    data={chartData}
                    lines={[
                        { name: 'FPS', dataKey: 'fps', stroke: DIAGNOSTICS_CONFIG.CHART.COLORS.FPS },
                        { name: 'TPS', dataKey: 'tps', stroke: '#3b82f6' }
                    ]}
                />
                <PerformanceChart
                    title="Frame Time Analysis"
                    data={chartData}
                    area
                    lines={[{ name: 'Frame Time', dataKey: 'frameTime', stroke: DIAGNOSTICS_CONFIG.CHART.COLORS.MEMORY }]}
                />
            </div>
        </div>
    );
};
