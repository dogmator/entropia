import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';

import { COLORS, RENDER } from '../../constants';
// Import Engine type
import type { SimulationEngine } from '../../simulation/Engine';
import { useSimulation } from '../context/SimulationContext';

interface EntitiesProps {
    engine: SimulationEngine;
}

export const Entities: React.FC<EntitiesProps> = ({ engine }) => {
    const preyRef = useRef<THREE.InstancedMesh>(null!);
    const predRef = useRef<THREE.InstancedMesh>(null!);
    const foodRef = useRef<THREE.InstancedMesh>(null!);

    const dummy = useMemo(() => new THREE.Object3D(), []);
    const MAX_INSTANCES = RENDER.maxInstances;

    // Common geometry for organisms (cone)
    const orgGeo = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.8, 2.5, 12);
        geo.rotateX(Math.PI / 2);
        return geo;
    }, []);

    // Common geometry for food (sphere)
    const foodGeo = useMemo(() => new THREE.SphereGeometry(2, 8, 8), []);

    const forward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
    const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
    const frustum = useMemo(() => new THREE.Frustum(), []);
    const tmpSphere = useMemo(() => new THREE.Sphere(), []);
    const tmpPos = useMemo(() => new THREE.Vector3(), []);

    const { setHoveredEntity, setTooltipPos, speed, isLoading } = useSimulation(); // Integrated speed and interaction state

    // Interaction State
    const lastHoverTimeRef = useRef(0);

    useFrame((state) => {
        if (!preyRef.current || !predRef.current || !foodRef.current) {return;}

        // 1. Update Simulation
        // We now respect the 'speed' multiplier. For 'speed === 0' (pause), we skip updates.
        // For higher speeds, we might run multiple steps, but for simplicity/stability in R3F loop,
        // we'll stick to 1 step per frame if speed > 0, relying on Engine's internal delta handling 
        // or just calling update() once. The Engine typically handles 'pause' if we don't call update, 
        // but here we control it explicitly.
        if (speed > 0 && !isLoading) {
            // If speed is notably high (e.g. 5x), we could loop here, but Engine.update() 
            // is usually designed for a single tick. We'll trust the Engine's internal delta 
            // or perform multiple ticks if needed. For now: single tick when running.
            // If 'speed' affects physics steps, we might need a loop:
            const steps = Math.floor(speed >= 1 ? speed : 1);
            // Note: simple integer steps for stability
            for (let s = 0; s < steps; s++) {
                engine.update();
            }
        }

        // 2. Frustum Culling Setup
        projScreenMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        const renderBuffers = engine.getRenderData();
        const { prey, predators, food, preyCount, predatorCount, foodCount } = renderBuffers;

        // 3. Raycasting for Interaction (Tooltips)
        // We only raycast every few frames to save performance, or on mouse move if we had a dedicated handler.
        // Here, continuous checking in useFrame is acceptable for "hover" effects if optimized.
        const now = state.clock.getElapsedTime();
        if (now - lastHoverTimeRef.current > 0.1) { // Check every 100ms
            lastHoverTimeRef.current = now;

            // We need to manually check intersections because instancedMesh pointer events 
            // can be tricky with high instance counts. 
            // Ideally @react-three/fiber's built-in pointer events on <instancedMesh> work well too.
            // Let's implement the standard R3F pointer events on the meshes below instead of manual raycasting loop here.
            // Keeping this block empty for now, shifting logic to onPointerMove props.
        }

        // --- PREY ---
        let preyIdx = 0;
        for (let i = 0; i < preyCount; i++) {
            const offset = i * 13;
            const x = prey[offset + 0] || 0;
            const y = prey[offset + 1] || 0;
            const z = prey[offset + 2] || 0;
            const r = prey[offset + 6] || 0;

            tmpSphere.center.set(x, y, z);
            tmpSphere.radius = r;
            if (!frustum.intersectsSphere(tmpSphere)) {continue;}

            const vx = prey[offset + 3] || 0;
            const vy = prey[offset + 4] || 0;
            const vz = prey[offset + 5] || 0;

            dummy.position.set(x, y, z);
            const scale = r * engine.config.organismScale;
            dummy.scale.set(scale, scale, scale);

            const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (spd > 0.01) {
                tmpPos.set(vx / spd, vy / spd, vz / spd);
                dummy.quaternion.setFromUnitVectors(forward, tmpPos);
            } else {
                dummy.rotation.set(0, 0, 0);
            }
            dummy.updateMatrix();
            preyRef.current.setMatrixAt(preyIdx++, dummy.matrix);
        }
        preyRef.current.count = preyIdx;
        preyRef.current.instanceMatrix.needsUpdate = true;

        // --- PREDATORS ---
        let predIdx = 0;
        for (let i = 0; i < predatorCount; i++) {
            const offset = i * 13;
            const x = predators[offset + 0] || 0;
            const y = predators[offset + 1] || 0;
            const z = predators[offset + 2] || 0;
            const r = predators[offset + 6] || 0;

            tmpSphere.center.set(x, y, z);
            tmpSphere.radius = r;
            if (!frustum.intersectsSphere(tmpSphere)) {continue;}

            const vx = predators[offset + 3] || 0;
            const vy = predators[offset + 4] || 0;
            const vz = predators[offset + 5] || 0;

            dummy.position.set(x, y, z);
            const scale = r * engine.config.organismScale;
            dummy.scale.set(scale, scale, scale);

            const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (spd > 0.01) {
                tmpPos.set(vx / spd, vy / spd, vz / spd);
                dummy.quaternion.setFromUnitVectors(forward, tmpPos);
            } else {
                dummy.rotation.set(0, 0, 0);
            }
            dummy.updateMatrix();
            predRef.current.setMatrixAt(predIdx++, dummy.matrix);
        }
        predRef.current.count = predIdx;
        predRef.current.instanceMatrix.needsUpdate = true;

        // --- FOOD ---
        let foodIdx = 0;
        const rotationTime = state.clock.getElapsedTime();
        for (let i = 0; i < foodCount; i++) {
            const offset = i * 5;
            const x = food[offset + 0] || 0;
            const y = food[offset + 1] || 0;
            const z = food[offset + 2] || 0;
            const r = food[offset + 3] || 0;

            tmpSphere.center.set(x, y, z);
            tmpSphere.radius = r;
            if (!frustum.intersectsSphere(tmpSphere)) {continue;}

            const scale = (r / 2) * 2.5 * engine.config.foodScale;
            dummy.position.set(x, y, z);
            dummy.scale.set(scale, scale, scale);
            dummy.rotation.set(rotationTime * 0.5, rotationTime * 0.3, 0);
            dummy.updateMatrix();
            foodRef.current.setMatrixAt(foodIdx++, dummy.matrix);
        }
        foodRef.current.count = foodIdx;
        foodRef.current.instanceMatrix.needsUpdate = true;

        // Critical for raycasting to work on InstancedMesh with dynamic updates!
        if (foodRef.current.geometry.boundingSphere === null) {
            foodRef.current.geometry.computeBoundingSphere();
        }
    });

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>, type: 'prey' | 'predator' | 'food') => {
        e.stopPropagation();
        // Instance ID is in e.instanceId
        if (e.instanceId === undefined) {
            if (type === 'food') {console.log('[FoodDebug] instanceId undefined');}
            return;
        }

        if (type === 'food') {console.log('[FoodDebug] Lookup for instanceId:', e.instanceId);}

        // Use exact lookup via Instance ID mapping which matches the render order
        const entity = engine.getEntityByInstanceId(type, e.instanceId);

        if (entity) {
            console.log(entity); // Log full entity properties as requested
            setHoveredEntity(entity);
            // Use pointer screen coordinates directly for stable tooltip
            setTooltipPos({ x: e.clientX, y: e.clientY });
        }
    }, [engine, setHoveredEntity, setTooltipPos]);

    // Reset tooltip when pointer leaves object
    const handlePointerOut = useCallback(() => {
        setHoveredEntity(null);
    }, [setHoveredEntity]);

    // Reset tooltip when pointer misses
    const handlePointerMiss = useCallback(() => {
        setHoveredEntity(null);
    }, [setHoveredEntity]);

    return (
        <group onPointerMissed={handlePointerMiss}>
            <instancedMesh
                ref={preyRef}
                args={[orgGeo, undefined, MAX_INSTANCES]}
                frustumCulled={false}
                onPointerMove={(e) => handlePointerMove(e, 'prey')}
                onPointerOut={handlePointerOut}
            >
                <meshPhongMaterial
                    color={COLORS.prey.base}
                    transparent
                    opacity={0.92}
                    emissive={COLORS.prey.base}
                    emissiveIntensity={0.15}
                    shininess={30}
                />
            </instancedMesh>

            <instancedMesh
                ref={predRef}
                args={[orgGeo, undefined, MAX_INSTANCES]}
                frustumCulled={false}
                onPointerMove={(e) => handlePointerMove(e, 'predator')}
                onPointerOut={handlePointerOut}
            >
                <meshPhongMaterial
                    color={COLORS.predator.base}
                    transparent
                    opacity={0.92}
                    emissive={COLORS.predator.base}
                    emissiveIntensity={0.2}
                    shininess={40}
                />
            </instancedMesh>

            <instancedMesh
                ref={foodRef}
                args={[foodGeo, undefined, MAX_INSTANCES * 2]}
                frustumCulled={false}
                onPointerMove={(e) => handlePointerMove(e, 'food')}
                onPointerOut={handlePointerOut}
            >
                <meshPhongMaterial
                    color={COLORS.food.base}
                    emissive={COLORS.food.emissive}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={0.85}
                    shininess={100}
                />
            </instancedMesh>
        </group>
    );
};
