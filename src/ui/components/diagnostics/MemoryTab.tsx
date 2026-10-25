import React, { useMemo } from 'react';

import { DIAGNOSTICS_CONFIG } from '@/config';
import { PerformanceHelpers } from '@/core/utils/PerformanceUtils.utils';
import { t } from '@/i18n';
import type { MemoryStats, SystemMetrics } from '@/types';

import { MAX_PERCENTAGE, MetricCard, PerformanceChart } from './Shared';

interface MemoryTabProps {
    memoryStats: MemoryStats | null;
    systemMetrics: SystemMetrics[];
}

const CHART_DISPLAY_DIVISOR = 2;
const CHART_HEIGHT = 250;
const MATCH_VALUE_INDEX = 1;
const MATCH_UNIT_INDEX = 2;

const formatValue = (formatted: string) => {
    const match = /^([\d.]+)\s+([a-zA-Z]+)$/.exec(formatted);
    return match ? { value: match[MATCH_VALUE_INDEX] ?? '', unit: match[MATCH_UNIT_INDEX] ?? '' } : { value: formatted, unit: '' };
};

const MemoryHistory = ({ systemMetrics }: { systemMetrics: SystemMetrics[] }) => (
    <PerformanceChart
        title="JavaScript Heap Usage Over Time"
        data={systemMetrics.slice(-DIAGNOSTICS_CONFIG.CHART.HISTORY_LENGTH / CHART_DISPLAY_DIVISOR)}
        area
        height={CHART_HEIGHT}
        emptyMessage={t.diagnostics.memoryCollecting}
        lines={[{
            name: t.diagnostics.memory,
            dataKey: 'memory',
            stroke: '#8b5cf6'
        }]}
    />
);

export const MemoryTab: React.FC<MemoryTabProps> = ({ memoryStats, systemMetrics }) => {
    const formatBytes = useMemo(() => (bytes: number) => PerformanceHelpers.format.formatBytes(bytes), []);
    const getMemoryColor = useMemo(() => (pct: number) => PerformanceHelpers.color.getMemoryColor(pct), []);

    const usedPercentage = memoryStats
        ? (memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * MAX_PERCENTAGE : undefined;

    const unavailable = { value: 'N/A', unit: '' };
    const used = memoryStats ? formatValue(formatBytes(memoryStats.usedJSHeapSize)) : unavailable;
    const total = memoryStats ? formatValue(formatBytes(memoryStats.totalJSHeapSize)) : unavailable;
    const limit = memoryStats ? formatValue(formatBytes(memoryStats.jsHeapSizeLimit)) : unavailable;

    return (
        <div className="space-y-6">
            {/* Memory Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title={t.diagnostics.used}
                    value={used.value}
                    unit={used.unit}
                    color={usedPercentage === undefined ? 'text-gray-400' : getMemoryColor(usedPercentage)}
                    {...(usedPercentage === undefined ? {} : { trend: usedPercentage })}
                />
                <MetricCard
                    title={t.diagnostics.totalAllocated}
                    value={total.value}
                    unit={total.unit}
                    color="text-blue-400"
                />
                <MetricCard
                    title={t.settings.limit}
                    value={limit.value}
                    unit={limit.unit}
                    color="text-purple-400"
                />
            </div>

            <p className="text-xs text-gray-500">{t.diagnostics.jsHeapScope}</p>

            {/* Memory Chart */}
            {memoryStats === null
                ? <p role="status" className="text-xs text-gray-400">{t.diagnostics.memoryUnsupported}</p>
                : <MemoryHistory systemMetrics={systemMetrics} />}
        </div>
    );
};
