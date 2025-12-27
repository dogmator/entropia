import React, { useMemo } from 'react';

import { DIAGNOSTICS_CONFIG } from '@/constants';
import { PerformanceHelpers } from '@/core/utils/PerformanceUtils';
import type { MemoryStats, SystemMetrics } from '@/types';

import { MAX_PERCENTAGE, MetricCard, PerformanceChart } from './Shared';

interface MemoryTabProps {
    memoryStats: MemoryStats;
    systemMetrics: SystemMetrics[];
}

const CHART_DISPLAY_DIVISOR = 2;
const CHART_HEIGHT = 250;
const formatValue = (formatted: string) => {
    const match = formatted.match(/^([\d.]+)\s+([a-zA-Z]+)$/);
    return match ? { value: match[1] || '', unit: match[2] || '' } : { value: formatted, unit: '' };
};

export const MemoryTab: React.FC<MemoryTabProps> = ({ memoryStats, systemMetrics }) => {
    const formatBytes = useMemo(() => PerformanceHelpers.format.formatBytes, []);
    const getMemoryColor = useMemo(() => PerformanceHelpers.color.getMemoryColor, []);

    // Use specific chart config
    const chartData = systemMetrics.slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH / CHART_DISPLAY_DIVISOR);
    const usedPercentage = (memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * MAX_PERCENTAGE;

    const used = formatValue(formatBytes(memoryStats.usedJSHeapSize));
    const total = formatValue(formatBytes(memoryStats.totalJSHeapSize));
    const limit = formatValue(formatBytes(memoryStats.jsHeapSizeLimit));

    return (
        <div className="space-y-6">
            {/* Memory Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title="Використано"
                    value={used.value}
                    unit={used.unit}
                    color={getMemoryColor(usedPercentage)}
                    trend={usedPercentage}
                />
                <MetricCard
                    title="Загалом виділено"
                    value={total.value}
                    unit={total.unit}
                    color="text-blue-400"
                />
                <MetricCard
                    title="Ліміт"
                    value={limit.value}
                    unit={limit.unit}
                    color="text-purple-400"
                />
            </div>

            {/* Memory Chart */}
            <PerformanceChart
                title="Memory Usage Over Time"
                data={chartData}
                area
                height={CHART_HEIGHT}
                lines={[{
                    name: 'Memory', // Changed from "Memory %" as it shows bytes usually
                    dataKey: 'memory',
                    stroke: '#8b5cf6'
                }]}
            />
        </div>
    );
};
