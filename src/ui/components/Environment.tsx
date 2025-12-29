import React, { useMemo } from 'react';
import * as THREE from 'three';

import { COLORS, WORLD_SIZE, ZONE_DEFAULTS } from '../../config';
// Import Engine type (assuming it is exported from Engine.ts or we use a partial interface if circular deps exist)
// Better to define a minimal interface here or import from types if available.
// Since Engine.ts is a class, we can just use 'any' temporarily? NO, strict rules!
// Let's import the class as a type.
// Let's import the class as a type.
import type { ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import { useSimulation } from '../context/SimulationContext';

interface EnvironmentProps {
    engine: ISimulationEngine;
}

export const Environment: React.FC<EnvironmentProps> = ({ engine }) => {
    const ws = engine.worldConfig?.WORLD_SIZE ?? WORLD_SIZE;
    const { setHoveredEntity, setTooltipPos } = useSimulation();

    // World Boundary Box
    const boxLines = useMemo(() => {
        const boxGeo = new THREE.BoxGeometry(ws, ws, ws);
        const boxEdges = new THREE.EdgesGeometry(boxGeo);
        const boxMat = new THREE.LineBasicMaterial({
            color: COLORS.ui.accent,
            transparent: true,
            opacity: 0.08,
        });
        const lines = new THREE.LineSegments(boxEdges, boxMat);
        lines.position.set(ws / 2, ws / 2, ws / 2);
        return lines;
    }, [ws]);

    // Environmental Zones
    const zones = useMemo(() => {
        // engine.zones is a Map, we need to handle it safely
        const zoneValues = Array.from(engine.zones.values());
        return zoneValues.map((zone, index) => {
            const zoneColor = ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS]?.color || 0xffffff;
            return (
                <mesh key={`zone-${index}`} position={[zone.center.x, zone.center.y, zone.center.z]}>
                    <sphereGeometry args={[zone.radius, 16, 16]} />
                    <meshBasicMaterial
                        color={zoneColor}
                        transparent
                        opacity={0.05}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            );
        });
    }, [engine.zones]);

    // Static Obstacles
    const obstacles = useMemo(() => {
        const obstacleValues = Array.from(engine.obstacles.values());
        return obstacleValues.map((obs) => (
            <mesh
                key={obs.id}
                position={[obs.position.x, obs.position.y, obs.position.z]}
                onPointerMove={(e) => {
                    e.stopPropagation();
                    console.info('[ObstacleHover]', obs);
                    setHoveredEntity(obs);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
            >
                <icosahedronGeometry args={[obs.radius, 2]} />
                <meshPhongMaterial
                    color={obs.color}
                    transparent
                    opacity={obs.opacity}
                    flatShading
                    emissive={COLORS.obstacle.base}
                    emissiveIntensity={0.1}
                />
            </mesh>
        ));
    }, [engine.obstacles, setHoveredEntity, setTooltipPos]);

    return (
        <group>
            <primitive object={boxLines} />
            {zones}
            {obstacles}
        </group>
    );
};
