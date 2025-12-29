import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { WORLD_SIZE } from '../../config';
import { useSimulation } from '../context/SimulationContext';
import { SimulationDriver } from './SimulationDriver';

const CameraTracker: React.FC = () => {
    const { camera, controls } = useThree();
    const { setCameraState } = useSimulation();

    useFrame(() => {
        if (!controls) { return; }

        const orbitControls = controls as unknown as OrbitControlsImpl;
        const target = orbitControls.target;
        const distance = camera.position.distanceTo(target);

        setCameraState({
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            target: { x: target.x, y: target.y, z: target.z },
            zoom: camera instanceof THREE.PerspectiveCamera
                ? distance / (camera.position.length() * 0.5)
                : (camera as THREE.OrthographicCamera).zoom || 1,
            distance,
            fov: (camera as THREE.PerspectiveCamera).fov || 60,
            aspect: (camera as THREE.PerspectiveCamera).aspect || 1,
            near: camera.near,
            far: camera.far,
        });
    });

    return null;
};


interface SceneContainerProps {
    worldSize?: number;
    children: React.ReactNode;
}

export const SceneContainer: React.FC<SceneContainerProps> = ({
    worldSize = WORLD_SIZE,
    children
}) => {
    const { autoRotate, autoRotateSpeed } = useSimulation();

    return (
        <Canvas
            shadows
            className="w-full h-full block"
            gl={{
                antialias: true,
                powerPreference: 'high-performance',
                alpha: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
            }}
            style={{ background: '#020205' }}
            onPointerMissed={(e) => console.info('[SceneDebug] Pointer missed target at:', e.clientX, e.clientY)}
            onPointerMove={(e) => console.info('[SceneDebug] Global Pointer Move:', e.clientX, e.clientY)}
        >
            <PerspectiveCamera
                makeDefault
                fov={60}
                near={0.1}
                far={5000}
                position={[worldSize * 1.2, worldSize * 1.0, worldSize * 1.2]}
            />

            <OrbitControls
                target={[worldSize / 2, worldSize / 2, worldSize / 2]}
                enableDamping
                dampingFactor={0.05}
                minDistance={100}
                maxDistance={worldSize * 3}
                autoRotate={autoRotate}
                autoRotateSpeed={autoRotateSpeed}
            />

            <CameraTracker />
            <SimulationDriver />

            <ambientLight intensity={0.35} />

            <directionalLight
                position={[worldSize, worldSize * 1.5, worldSize]}
                intensity={0.8}
            />

            <directionalLight
                position={[-worldSize, worldSize * 0.5, -worldSize]}
                intensity={0.3}
                color="#4488ff"
            />

            {children}
        </Canvas>
    );
};
