 
import React, { useMemo } from 'react';
import * as THREE from 'three';

import { COLORS, ENVIRONMENT_RENDERING, WORLD_SIZE, ZONE_DEFAULTS } from '../../config';
import { Obstacle } from '../../simulation';
import type { IEntityInfo,ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import type { EcologicalZone } from '../../types';
import { useSimulation } from '../context/SimulationContext';

interface EnvironmentProps {
    engine: ISimulationEngine;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const WorldBoundary = ({ size }: { size: number }) => {
    const boxLines = useMemo(() => {
        const boxGeo = new THREE.BoxGeometry(size, size, size);
        const boxEdges = new THREE.EdgesGeometry(boxGeo);
        const boxMat = new THREE.LineBasicMaterial({
            color: COLORS.ui.accent,
            transparent: true,
            opacity: ENVIRONMENT_RENDERING.BOX_OPACITY,
        });
        const lines = new THREE.LineSegments(boxEdges, boxMat);
        const center = size / ENVIRONMENT_RENDERING.CENTER_DIVIDER;
        lines.position.set(center, center, center);
        return lines;
    }, [size]);

    return <primitive object={boxLines} />;
};

const EcologicalZones = ({ engine }: { engine: ISimulationEngine }) => {
    const zones = useMemo(() => {
        const zoneValues = Array.from(engine.zones.values());
        return zoneValues.map((zone: EcologicalZone, index: number) => {
            const zoneColor = ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS]?.color || ENVIRONMENT_RENDERING.DEFAULT_ZONE_COLOR;
            return (
                <mesh key={`zone-${index}`} position={[zone.center.x, zone.center.y, zone.center.z]}>
                    <sphereGeometry args={[zone.radius, ENVIRONMENT_RENDERING.ZONE_SEGMENTS, ENVIRONMENT_RENDERING.ZONE_SEGMENTS]} />
                    <meshBasicMaterial
                        color={zoneColor}
                        transparent
                        opacity={ENVIRONMENT_RENDERING.ZONE_OPACITY}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            );
        });
    }, [engine.zones]);

    return <>{zones}</>;
};

const StaticObstacles = ({ engine }: { engine: ISimulationEngine }) => {
    const { setHoveredEntity, setTooltipPos } = useSimulation();

    const obstacles = useMemo(() => {
        const obstacleValues = Array.from(engine.obstacles.values());
        return obstacleValues.map((obs: Obstacle) => (
            <mesh
                key={obs.id}
                position={[obs.position.x, obs.position.y, obs.position.z]}
                onPointerMove={(e) => {
                    e.stopPropagation();
                    setHoveredEntity(obs as unknown as IEntityInfo);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
            >
                <icosahedronGeometry args={[obs.radius, ENVIRONMENT_RENDERING.OBSTACLE_SEGMENTS]} />
                <meshPhongMaterial
                    color={obs.color}
                    transparent
                    opacity={obs.opacity}
                    flatShading={true}
                    emissive={COLORS.obstacle.base}
                    emissiveIntensity={ENVIRONMENT_RENDERING.OBSTACLE_EMISSIVE_INTENSITY}
                />
            </mesh>
        ));
    }, [engine.obstacles, setHoveredEntity, setTooltipPos]);

    return <>{obstacles}</>;
};

export const Environment: React.FC<EnvironmentProps> = ({ engine }) => {
    const ws = engine.worldConfig?.WORLD_SIZE ?? WORLD_SIZE;

    return (
        <group>
            <WorldBoundary size={ws} />
            <EcologicalZones engine={engine} />
            <StaticObstacles engine={engine} />
        </group>
    );
};
