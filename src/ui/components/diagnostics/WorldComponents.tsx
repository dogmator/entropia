import React from 'react';

import { ENGINE_CONSTANTS, WORLD_SIZE } from '@/config';
import { t } from '@/i18n';
import type { CameraState } from '@/shared/interfaces/CameraState';
import type { SimulationStats } from '@/types';

const DECIMALS_CAMERA = 0;
const DECIMALS_SCALE = 2;
const DECIMALS_OCCUPANCY = 2;

const formatNumber = (value: number | undefined, defaultValue: number, decimals = 0) =>
    (value ?? defaultValue).toFixed(decimals);

const getWorldArea = (worldSize: number | undefined): string => {
    const size = worldSize ?? WORLD_SIZE;
    return `${(size * size).toLocaleString('en-US')} u²`;
};

interface WorldViewProps {
    currentStats: SimulationStats;
    cameraState: CameraState;
    worldScale: number;
}

const cameraPosition = (cameraState: CameraState) => ({
    x: formatNumber(cameraState.position.x, 0, DECIMALS_CAMERA),
    y: formatNumber(cameraState.position.y, 0, DECIMALS_CAMERA),
    z: formatNumber(cameraState.position.z, 0, DECIMALS_CAMERA)
});

const cameraTarget = (cameraState: CameraState) => ({
    x: formatNumber(cameraState.target.x, 0, DECIMALS_CAMERA),
    y: formatNumber(cameraState.target.y, 0, DECIMALS_CAMERA),
    z: formatNumber(cameraState.target.z, 0, DECIMALS_CAMERA)
});

const WorldSizeCard = ({ currentStats }: { currentStats: SimulationStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">{t.entity.worldSize}</span>
            <span className="text-lg font-mono font-bold text-blue-400">
                {formatNumber(currentStats.worldSize, WORLD_SIZE)}×{formatNumber(currentStats.worldSize, WORLD_SIZE)}×{formatNumber(currentStats.worldSize, WORLD_SIZE)}
            </span>
        </div>
        <div className="text-xs text-gray-500">
            {t.diagnostics.area} {getWorldArea(currentStats.worldSize)}
        </div>
    </div>
);

const CameraPositionCard = ({ cameraState }: { cameraState: CameraState }) => {
    const pos = cameraPosition(cameraState);
    return (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">{t.settings.cameraPosition}</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                    ({pos.x}, {pos.y}, {pos.z})
                </span>
            </div>
            <div className="text-xs text-gray-500">
                X: {pos.x}, Y: {pos.y}, Z: {pos.z}
            </div>
        </div>
    );
};

const CameraTargetCard = ({ cameraState }: { cameraState: CameraState }) => {
    const target = cameraTarget(cameraState);
    return (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">{t.settings.cameraTarget}</span>
                <span className="text-lg font-mono font-bold text-blue-400">
                    ({target.x}, {target.y}, {target.z})
                </span>
            </div>
            <div className="text-xs text-gray-500">
                X: {target.x}, Y: {target.y}, Z: {target.z}
            </div>
        </div>
    );
};

const ScaleCard = ({ cameraState, worldScale }: Pick<WorldViewProps, 'cameraState' | 'worldScale'>) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">{t.settings.worldScale}</span>
            <span className="text-lg font-mono font-bold text-purple-400">
                {formatNumber(worldScale, 1, DECIMALS_SCALE)}×
            </span>
        </div>
        <div className="text-xs text-gray-500">
            {t.diagnostics.distance} {formatNumber(cameraState.distance, 0, 0)}
        </div>

    </div>
);

export const WorldGeometry: React.FC<WorldViewProps> = ({ currentStats, cameraState, worldScale }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <WorldSizeCard currentStats={currentStats} />
        <CameraPositionCard cameraState={cameraState} />
        <CameraTargetCard cameraState={cameraState} />
        <ScaleCard cameraState={cameraState} worldScale={worldScale} />

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-widest">{t.settings.camera}</span>
                <span className="text-lg font-mono font-bold text-cyan-400">
                    {formatNumber(cameraState.fov, ENGINE_CONSTANTS.DEFAULT_CAMERA_FOV, 0)}°
                </span>
            </div>
            <div className="text-xs text-gray-500">
                FOV: {formatNumber(cameraState.fov, ENGINE_CONSTANTS.DEFAULT_CAMERA_FOV, 0)}°
            </div>
        </div>
    </div>
);

export const WorldZones: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">{t.diagnostics.ecologicalZones}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">{t.diagnostics.growthZone}</div>
                <div className="text-sm font-mono text-emerald-400">{currentStats.growthZones ?? 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">{t.diagnostics.neutralZones}</div>
                <div className="text-sm font-mono text-yellow-400">{currentStats.neutralZones ?? 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">{t.diagnostics.dangerZones}</div>
                <div className="text-sm font-mono text-red-400">{currentStats.dangerZones ?? 0}</div>
            </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
                </div>
                <div className="text-xs text-gray-400">{t.diagnostics.allZones}</div>
                <div className="text-sm font-mono text-purple-400">{currentStats.totalZones ?? 0}</div>
            </div>
        </div>
    </div>
);

export const SpatialGrid: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">{t.diagnostics.spatialGrid}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">{t.diagnostics.cellSize}</span>
                    <span className="text-blue-400 font-mono">{currentStats.cellSize ?? ENGINE_CONSTANTS.MAX_CELL_SIZE}×{currentStats.cellSize ?? ENGINE_CONSTANTS.MAX_CELL_SIZE}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">{t.diagnostics.cellCount}</span>
                    <span className="text-emerald-400 font-mono">{currentStats.totalCells ?? 0}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">{t.diagnostics.filledCells}</span>
                    <span className="text-yellow-400 font-mono">{currentStats.occupiedCells ?? 0}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-400">{t.diagnostics.maxCellLoad}</span>
                    <span className="text-red-400 font-mono">{currentStats.maxDensity ?? 0}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">{t.diagnostics.meanCellLoad}</span>
                    <span className="text-cyan-400 font-mono">{(currentStats.gridEfficiency ?? 0).toFixed(DECIMALS_OCCUPANCY)}</span>
                </div>
            </div>
        </div>
    </div>
);

export const WorldStats: React.FC<{ currentStats: SimulationStats }> = ({ currentStats }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-medium text-gray-300 mb-4">{t.stats.worldStats}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400 mb-1">{currentStats.foodSpawnRate ?? 0}</div>
                <div className="text-xs text-gray-400">{t.settings.foodSpawnRate}</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">{currentStats.obstacleCount ?? 0}</div>
                <div className="text-xs text-gray-400">{t.entity.obstacles}</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">{currentStats.worldAge ?? 0}</div>
                <div className="text-xs text-gray-400">{t.stats.worldAge}</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">{currentStats.activeZones ?? 0}</div>
                <div className="text-xs text-gray-400">{t.diagnostics.activeZones}</div>
            </div>
        </div>
    </div>
);
