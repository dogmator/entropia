import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { WORLD_SIZE } from '../../config';
import { useSimulation } from '../context/SimulationContext';
import type { CameraSnapshot } from '../context/hooks/useSimulationSettings';

const CAMERA_ZOOM_DIVISOR = 0.5;
const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 5000;
const CAMERA_POSITION_XZ_FACTOR = 1.2;
const CAMERA_POSITION_Y_FACTOR = 1.0;
const TARGET_CENTER_DIVISOR = 2;
const DAMPING_FACTOR = 0.05;
const MIN_DISTANCE = 100;
const MAX_DISTANCE_FACTOR = 3;
const AMBIENT_INTENSITY = 0.35;
const DIR_LIGHT_1_INTENSITY = 0.8;
const DIR_LIGHT_1_Y_FACTOR = 1.5;
const DIR_LIGHT_2_INTENSITY = 0.3;
const DIR_LIGHT_2_Y_FACTOR = 0.5;

const CameraTracker: React.FC = () => {
    const { camera, controls } = useThree();
    const { setCameraState, cameraSnapshot, setCameraSnapshot } = useSimulation();
    const appliedRef = useRef(false);

    // Restore full camera state from URL on first mount
    useEffect(() => {
        if (appliedRef.current || !controls || cameraSnapshot === null) return;
        appliedRef.current = true;

        const orbitControls = controls as unknown as OrbitControlsImpl;
        camera.position.set(cameraSnapshot.px, cameraSnapshot.py, cameraSnapshot.pz);
        orbitControls.target.set(cameraSnapshot.tx, cameraSnapshot.ty, cameraSnapshot.tz);
        camera.updateProjectionMatrix();
        orbitControls.update();
    }, [camera, controls, cameraSnapshot]);

    // Sync full camera state to URL when user finishes zooming/orbiting
    useEffect(() => {
        if (!controls) return;
        const orbitControls = controls as unknown as OrbitControlsImpl;

        const onEnd = () => {
            const { x: px, y: py, z: pz } = camera.position;
            const { x: tx, y: ty, z: tz } = orbitControls.target;
            if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return;
            const snapshot: CameraSnapshot = { px, py, pz, tx, ty, tz };
            setCameraSnapshot(snapshot);
        };

        orbitControls.addEventListener('end', onEnd);
        return () => { orbitControls.removeEventListener('end', onEnd); };
    }, [camera, controls, setCameraSnapshot]);

    useFrame(() => {
        if (!controls) { return; }

        const orbitControls = controls as unknown as OrbitControlsImpl;
        const target = orbitControls.target;
        const distance = camera.position.distanceTo(target);

        setCameraState({
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            target: { x: target.x, y: target.y, z: target.z },
            zoom: camera instanceof THREE.PerspectiveCamera
                ? distance / (camera.position.length() * CAMERA_ZOOM_DIVISOR)
                : (camera as THREE.OrthographicCamera).zoom,
            distance,
            fov: (camera as THREE.PerspectiveCamera).fov,
            aspect: (camera as THREE.PerspectiveCamera).aspect,
            near: camera.near,
            far: camera.far,
        });
    });

    return null;
};

const Lighting: React.FC<{ worldSize: number }> = ({ worldSize }) => (
    <>
        <ambientLight intensity={AMBIENT_INTENSITY} />
        <directionalLight
            position={[worldSize, worldSize * DIR_LIGHT_1_Y_FACTOR, worldSize]}
            intensity={DIR_LIGHT_1_INTENSITY}
        />
        <directionalLight
            position={[-worldSize, worldSize * DIR_LIGHT_2_Y_FACTOR, -worldSize]}
            intensity={DIR_LIGHT_2_INTENSITY}
            color="#4488ff"
        />
    </>
);

interface SceneContainerProps {
    worldSize?: number;
    children: React.ReactNode;
}

export const SceneContainer: React.FC<SceneContainerProps> = ({
    worldSize = WORLD_SIZE,
    children
}) => {
    const { isAutoRotate, autoRotateSpeed } = useSimulation();

    return (
        <Canvas
            shadows
            className="w-full h-full block"
            gl={{
                antialias: true,
                powerPreference: 'high-performance',
                alpha: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: CAMERA_POSITION_XZ_FACTOR,
            }}
            style={{ background: '#020205' }}
        >
            <PerspectiveCamera
                makeDefault
                fov={CAMERA_FOV}
                near={CAMERA_NEAR}
                far={CAMERA_FAR}
                position={[worldSize * CAMERA_POSITION_XZ_FACTOR, worldSize * CAMERA_POSITION_Y_FACTOR, worldSize * CAMERA_POSITION_XZ_FACTOR]}
            />

            <OrbitControls
                makeDefault
                target={[worldSize / TARGET_CENTER_DIVISOR, worldSize / TARGET_CENTER_DIVISOR, worldSize / TARGET_CENTER_DIVISOR]}
                enableDamping
                dampingFactor={DAMPING_FACTOR}
                minDistance={MIN_DISTANCE}
                maxDistance={worldSize * MAX_DISTANCE_FACTOR}
                autoRotate={isAutoRotate}
                autoRotateSpeed={autoRotateSpeed}
            />

            <CameraTracker />
            <Lighting worldSize={worldSize} />
            {children}
        </Canvas>
    );
};
