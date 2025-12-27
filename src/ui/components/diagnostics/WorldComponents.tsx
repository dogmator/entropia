import React from 'react';

import { ENGINE_CONSTANTS, WORLD_SIZE } from '@/constants';
import type { SimulationStats } from '@/types';

const SQUARED_UNIT_THRESHOLD_M = 1_000_000;
const SQUARED_UNIT_THRESHOLD_K = 1_000;
const DECIMALS_AREA_M = 2;
const DECIMALS_AREA_K = 1;
const ZOOM_PERCENTAGE_SCALE = 50;
const MAX_PERCENTAGE = 100;
const DEFAULT_GRID_EFFICIENCY = 95;

const formatNumber = (value: number | undefined, defaultValue: number, decimals: number = 0) =>
    (value ?? defaultValue).toFixed(decimals);

const getWorldArea = (worldSize: number | undefined) => {
    const size = worldSize ?? WORLD_SIZE;
    const areaInSquareUnits = size * size;

    if (areaInSquareUnits >= SQUARED_UNIT_THRESHOLD_M) {
        return (areaInSquareUnits / SQUARED_UNIT_THRESHOLD_M).toFixed(DECIMALS_AREA_M) + ' M²';
    } else if (areaInSquareUnits >= SQUARED_UNIT_THRESHOLD_K) {
        return (areaInSquareUnits / SQUARED_UNIT_THRESHOLD_K).toFixed(DECIMALS_AREA_K) + ' K²';
    } else {
        return areaInSquareUnits.toString() + ' u²';
    }
};

const getCameraPosition = (stats: SimulationStats) => ({
    x: formatNumber(stats.cameraX, 0, 0),
    y: formatNumber(stats.cameraY, 0, 0),
    z: formatNumber(stats.cameraZ, 0, 0),
});

const getCameraTarget = (stats: SimulationStats) => ({
    x: formatNumber(stats.targetX, 0, 0),
    y: formatNumber(stats.targetY, 0, 0),
    z: formatNumber(stats.targetZ, 0, 0),
});

export const WorldGeometry: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Розмір світу</span>
                <span className="text-lg font-mono font-bold text-blue-400">
                    {formatNumber(currentStats.worldSize, WORLD_SIZE)}×{formatNumber(currentStats.worldSize, WORLD_SIZE)}
                </span>
            </div>
            <div className="text-xs text-gray-500">
                Площа: {getWorldArea(currentStats.worldSize)}
            </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Позиція камери</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                    ({getCameraPosition(currentStats).x}, {getCameraPosition(currentStats).y}, {getCameraPosition(currentStats).z})
                </span>
            </div>
            <div className="text-xs text-gray-500">
                X: {getCameraPosition(currentStats).x}, Y: {getCameraPosition(currentStats).y}, Z: {getCameraPosition(currentStats).z}
            </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Ціль камери</span>
                <span className="text-lg font-mono font-bold text-blue-400">
                    ({getCameraTarget(currentStats).x}, {getCameraTarget(currentStats).y}, {getCameraTarget(currentStats).z})
                </span>
            </div>
            <div className="text-xs text-gray-500">
                X: {getCameraTarget(currentStats).x}, Y: {getCameraTarget(currentStats).y}, Z: {getCameraTarget(currentStats).z}
            </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Масштаб</span>
                <span className="text-lg font-mono font-bold text-purple-400">
                    {formatNumber(currentStats.zoom, ENGINE_CONSTANTS.DEFAULT_ZOOM, 2)}×
                </span>
            </div>
            <div className="text-xs text-gray-500">
                Дистанція: {formatNumber(currentStats.cameraDistance, 0, 0)}
            </div>
            <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300"
                    style={{ width: `${Math.min((currentStats.zoom ?? ENGINE_CONSTANTS.DEFAULT_ZOOM) * ZOOM_PERCENTAGE_SCALE, MAX_PERCENTAGE)}%` }}
                />
            </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Параметри камери</span>
                <span className="text-lg font-mono font-bold text-cyan-400">
                    {formatNumber(currentStats.cameraFov, ENGINE_CONSTANTS.DEFAULT_CAMERA_FOV, 0)}°
                </span>
            </div>
            <div className="text-xs text-gray-500">
                FOV: {formatNumber(currentStats.cameraFov, ENGINE_CONSTANTS.DEFAULT_CAMERA_FOV, 0)}°
            </div>
        </div>
    </div>
);

export const WorldZones: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Екологічні зони</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">Зона росту</div>
                <div className="text-sm font-mono text-emerald-400">{currentStats.growthZones || 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">Нейтральні зони</div>
                <div className="text-sm font-mono text-yellow-400">{currentStats.neutralZones || 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">Небезпечні зони</div>
                <div className="text-sm font-mono text-red-400">{currentStats.dangerZones || 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">Всього зон</div>
                <div className="text-sm font-mono text-purple-400">{currentStats.totalZones || 0}</div>
            </div>
        </div>
    </div>
);

export const SpatialGrid: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Просторова сітка</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">Розмір комірки:</span>
                    <span className="text-blue-400 font-mono">{currentStats.cellSize || ENGINE_CONSTANTS.MAX_CELL_SIZE}×{currentStats.cellSize || ENGINE_CONSTANTS.MAX_CELL_SIZE}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Кількість комірок:</span>
                    <span className="text-emerald-400 font-mono">{currentStats.totalCells || 0}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Заповнені комірки:</span>
                    <span className="text-yellow-400 font-mono">{currentStats.occupiedCells || 0}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">Середня щільність:</span>
                    <span className="text-purple-400 font-mono">{currentStats.avgDensity || 0}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Макс. щільність:</span>
                    <span className="text-red-400 font-mono">{currentStats.maxDensity || 0}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Ефективність сітки:</span>
                    <span className="text-cyan-400 font-mono">{currentStats.gridEfficiency || DEFAULT_GRID_EFFICIENCY}%</span>
                </div>
            </div>
        </div>
    </div>
);

export const WorldStats: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Статистика світу</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400 mb-1">{currentStats.foodSpawnRate || 0}</div>
                <div className="text-xs text-gray-400">Швидкість появи їжі</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">{currentStats.obstacleCount || 0}</div>
                <div className="text-xs text-gray-400">Перешкоди</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">{currentStats.worldAge || 0}</div>
                <div className="text-xs text-gray-400">Вік світу (хв)</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">{currentStats.activeZones || 0}</div>
                <div className="text-xs text-gray-400">Активні зони</div>
            </div>
        </div>
    </div>
);
