import React from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

import { DIAGNOSTICS_CONFIG } from '@/config';
import type { PerformanceMetrics } from '@/types';

export const MAX_PERCENTAGE = 100;
const CHART_HEIGHT = 200;
const CHART_FILL_OPACITY = 0.3;
const CHART_STROKE_WIDTH = 2;

export const MetricCard = React.memo(({ title, value, unit, color, trend, subtitle }: {
    title: string;
    value: number | string;
    unit: string;
    color: string;
    trend?: number;
    subtitle?: React.ReactNode;
}) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">{title}</span>
            <span className={`text-lg font-mono font-bold ${color}`}>
                {value}{unit}
            </span>
        </div>
        {subtitle && <div className="text-xs text-gray-500 mb-2">{subtitle}</div>}
        {trend !== undefined ? <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
            <div
                className="h-full bg-gradient-to-r from-emerald-500 to-yellow-500 transition-all duration-300"
                style={{ width: `${Math.min(MAX_PERCENTAGE, trend)}%` }}
            />
        </div> : null}
    </div>
));

MetricCard.displayName = 'MetricCard';

export interface ChartLineProps {
    name: string;
    dataKey: string;
    stroke: string;
}

export const PerformanceChart = React.memo(({
    title,
    data,
    lines,
    area = false,
    height = CHART_HEIGHT
}: {
    title: string;
    data: Partial<PerformanceMetrics>[];
    lines: ChartLineProps[];
    area?: boolean;
    height?: number;
}) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={height}>
            {area ? (
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DIAGNOSTICS_CONFIG.CHART.GRID_COLOR} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '8px' }}
                    />
                    {lines.map((line) => (
                        <Area
                            key={line.name}
                            name={line.name}
                            type="monotone"
                            dataKey={line.dataKey}
                            stroke={line.stroke}
                            fill={line.stroke}
                            fillOpacity={CHART_FILL_OPACITY}
                        />
                    ))}
                </AreaChart>
            ) : (
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DIAGNOSTICS_CONFIG.CHART.GRID_COLOR} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '8px' }}
                        labelFormatter={(value) => `Time: ${new Date(value).toLocaleTimeString()}`}
                    />
                    {lines.map((line) => (
                        <Line
                            key={line.name}
                            name={line.name}
                            type="monotone"
                            dataKey={line.dataKey}
                            stroke={line.stroke}
                            strokeWidth={CHART_STROKE_WIDTH}
                            dot={false}
                        />
                    ))}
                </LineChart>
            )}
        </ResponsiveContainer>
    </div>
));

PerformanceChart.displayName = 'PerformanceChart';
