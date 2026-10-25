import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { COLORS, ENVIRONMENT_RENDERING, ZONE_DEFAULTS } from '../../config';
import type { Obstacle } from '../../simulation/Entity';
import type { IEntityInfo,ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import type { EcologicalZone } from '../../types';
import { useSimulation } from '../context/SimulationContext';
import { gridAppearance } from './environmentVisuals';

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

/** The floor grid of the world. Its visibility and opacity follow the settings on every frame. */
const WorldGrid = ({ engine }: { engine: ISimulationEngine }) => {
    const size = engine.worldConfig.WORLD_SIZE;
    const gridRef = useRef<THREE.GridHelper>(null);

    const grid = useMemo(() => {
        const helper = new THREE.GridHelper(size, ENVIRONMENT_RENDERING.GRID_DIVISIONS, COLORS.ui.accent, COLORS.ui.accent);
        // The helper is centred on the origin, whereas the world spans from 0 to its size.
        helper.position.set(size / ENVIRONMENT_RENDERING.CENTER_DIVIDER, 0, size / ENVIRONMENT_RENDERING.CENTER_DIVIDER);
        const material = helper.material;
        material.transparent = true;
        material.depthWrite = false;
        return helper;
    }, [size]);

    useEffect(() => {
        return () => {
            grid.geometry.dispose();
            (grid.material as THREE.Material).dispose();
        };
    }, [grid]);

    useFrame(() => {
        const helper = gridRef.current;
        if (!helper) return;
        const appearance = gridAppearance(engine.config.showGrid, engine.config.gridOpacity);
        helper.visible = appearance.visible;
        (helper.material).opacity = appearance.opacity;
    });

    return <primitive ref={gridRef} object={grid} />;
};

const EcologicalZones = ({ engine }: { engine: ISimulationEngine }) => {
    const zones = useMemo(() => {
        const zoneValues = Array.from(engine.zones.values());
        return zoneValues.map((zone: EcologicalZone, index: number) => {
            const zoneColor = ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS].color;
            return (
                <mesh key={`zone-${String(index)}`} position={[zone.center.x, zone.center.y, zone.center.z]}>
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
    const groupRef = useRef<THREE.Group>(null);

    // The group follows the setting on every frame, so a change takes effect without a re-render. Hiding it does not
    // change the obstacles' part in the simulation, which collides with them whether they are drawn or not.
    useFrame(() => {
        if (groupRef.current) groupRef.current.visible = engine.config.showObstacles;
    });

    const obstacles = useMemo(() => {
        const obstacleValues = Array.from(engine.obstacles.values()) as Obstacle[];
        return obstacleValues.map((obs) => (
            <mesh
                key={obs.id}
                position={[obs.position.x, obs.position.y, obs.position.z]}
                onPointerMove={(e) => {
                    // Raycasting ignores visibility, so a hidden obstacle must not take the hover from the entity behind it.
                    if (groupRef.current && !groupRef.current.visible) return;
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

    return <group ref={groupRef}>{obstacles}</group>;
};

export const Environment: React.FC<EnvironmentProps> = ({ engine }) => {
    const ws = engine.worldConfig.WORLD_SIZE;

    return (
        <group>
            <WorldBoundary size={ws} />
            <WorldGrid engine={engine} />
            <EcologicalZones engine={engine} />
            <StaticObstacles engine={engine} />
        </group>
    );
};
