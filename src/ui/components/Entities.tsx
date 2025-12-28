import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { COLORS, PHYSICS, RENDER } from '../../config';
import type { SimulationEngine } from '../../simulation/Engine';
import { useSimulation } from '../context/SimulationContext';

/* eslint-disable react/prop-types */
interface EntitiesProps {
    engine: SimulationEngine;
}

// Позакомпонентні об'єкти для уникнення алокацій у кожному кадрі
const FORWARD = new THREE.Vector3(0, 0, 1);
const DUMMY = new THREE.Object3D();
const TMP_SPHERE = new THREE.Sphere();
const TMP_POS = new THREE.Vector3();
const PROJ_SCREEN_MATRIX = new THREE.Matrix4();
const FRUSTUM = new THREE.Frustum();

interface UpdateMeshParams {
    mesh: THREE.InstancedMesh;
    data: Float32Array;
    count: number;
    scaleMultiplier: number;
}

interface OrganismMeshProps {
    meshRef: React.RefObject<THREE.InstancedMesh>;
    geo: THREE.BufferGeometry;
    color: number;
    emissiveIntensity: number;
    shininess: number;
    onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut: () => void;
}

const OrganismMesh: React.FC<OrganismMeshProps> = ({
    meshRef, geo, color, emissiveIntensity, shininess, onPointerMove, onPointerOut
}) => (
    <instancedMesh
        ref={meshRef}
        args={[geo, undefined, RENDER.maxInstances]}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
    >
        <meshPhongMaterial
            color={color}
            transparent
            opacity={RENDER.materials.opacity}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            shininess={shininess}
        />
    </instancedMesh>
);

interface FoodMeshProps {
    meshRef: React.RefObject<THREE.InstancedMesh>;
    geo: THREE.BufferGeometry;
    onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut: () => void;
}

const FoodMesh: React.FC<FoodMeshProps> = ({ meshRef, geo, onPointerMove, onPointerOut }) => (
    <instancedMesh
        ref={meshRef}
        args={[geo, undefined, RENDER.maxInstances * RENDER.foodInstanceMultiplier]}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
    >
        <meshPhongMaterial
            color={COLORS.food.base}
            emissive={COLORS.food.emissive}
            emissiveIntensity={RENDER.materials.emissiveIntensity.food}
            transparent
            opacity={RENDER.materials.foodOpacity}
            shininess={RENDER.materials.shininess.food}
        />
    </instancedMesh>
);

/**
 * Встановлення трансформації для окремого екземпляра організму
 */
interface OrganismTransformParams {
    mesh: THREE.InstancedMesh;
    idx: number;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    radius: number;
    scaleMultiplier: number;
}

const setOrganismTransform = (params: OrganismTransformParams): void => {
    const { mesh, idx, pos, vel, radius, scaleMultiplier } = params;
    DUMMY.position.copy(pos);
    const scale = radius * scaleMultiplier;
    DUMMY.scale.set(scale, scale, scale);

    const spd = vel.length();
    if (spd > RENDER.geometry.velocityThreshold) {
        TMP_POS.copy(vel).divideScalar(spd);
        DUMMY.quaternion.setFromUnitVectors(FORWARD, TMP_POS);
    } else {
        DUMMY.rotation.set(0, 0, 0);
    }

    DUMMY.updateMatrix();
    mesh.setMatrixAt(idx, DUMMY.matrix);
};

/**
 * Оновлення InstancedMesh для організмів (хижаки/жертви)
 */
const updateOrganismMesh = (params: UpdateMeshParams): void => {
    const { mesh, data, count, scaleMultiplier } = params;
    let idx = 0;

    for (let i = 0; i < count; i++) {
        const offset = i * PHYSICS.ORGANISM_STRIDE;
        /* eslint-disable @typescript-eslint/no-magic-numbers */
        const x = data[offset + 0] ?? 0;
        const y = data[offset + 1] ?? 0;
        const z = data[offset + 2] ?? 0;
        const r = data[offset + 6] ?? 0;
        /* eslint-enable @typescript-eslint/no-magic-numbers */

        TMP_SPHERE.center.set(x, y, z);
        TMP_SPHERE.radius = r;

        if (FRUSTUM.intersectsSphere(TMP_SPHERE)) {
            /* eslint-disable @typescript-eslint/no-magic-numbers */
            const vx = data[offset + 3] ?? 0;
            const vy = data[offset + 4] ?? 0;
            const vz = data[offset + 5] ?? 0;
            /* eslint-enable @typescript-eslint/no-magic-numbers */

            setOrganismTransform({
                mesh,
                idx: idx++,
                pos: TMP_SPHERE.center,
                vel: TMP_POS.set(vx, vy, vz),
                radius: r,
                scaleMultiplier
            });
        }
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
};

/**
 * Оновлення InstancedMesh для їжі
 */
const updateFoodMesh = (params: UpdateMeshParams & { rotationTime: number }): void => {
    const { mesh, data, count, scaleMultiplier, rotationTime } = params;
    let idx = 0;

    for (let i = 0; i < count; i++) {
        const offset = i * PHYSICS.FOOD_STRIDE;
        /* eslint-disable @typescript-eslint/no-magic-numbers */
        const x = data[offset + 0] || 0;
        const y = data[offset + 1] || 0;
        const z = data[offset + 2] || 0;
        const r = data[offset + 3] || 0;
        /* eslint-enable @typescript-eslint/no-magic-numbers */

        TMP_SPHERE.center.set(x, y, z);
        TMP_SPHERE.radius = r;
        if (!FRUSTUM.intersectsSphere(TMP_SPHERE)) { continue; }

        const scale = r * RENDER.interaction.foodScaleBase * scaleMultiplier;
        DUMMY.position.set(x, y, z);
        DUMMY.scale.set(scale, scale, scale);
        DUMMY.rotation.set(
            rotationTime * RENDER.interaction.foodRotationSpeed,
            rotationTime * RENDER.interaction.foodRotationSecondary,
            0
        );
        DUMMY.updateMatrix();
        mesh.setMatrixAt(idx++, DUMMY.matrix);
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
};

/**
 * Параметри для анімації
 */
interface AnimationHookParams {
    refs: { prey: React.RefObject<THREE.InstancedMesh>, pred: React.RefObject<THREE.InstancedMesh>, food: React.RefObject<THREE.InstancedMesh> };
    engine: SimulationEngine;
    speed: number;
    isLoading: boolean;
}

/**
 * Хук для оновлення bounding volumes (сфери та бокси) для коректного Raycasting.
 * Оскільки InstancedMesh змінює матриці в кожному кадрі, Raycaster'у потрібні актуальні межі.
 */
const useBoundingVolumesUpdate = (refs: { prey: React.RefObject<THREE.InstancedMesh>, pred: React.RefObject<THREE.InstancedMesh>, food: React.RefObject<THREE.InstancedMesh> }) => {
    const lastHoverTimeRef = useRef(0);

    useFrame((state) => {
        const now = state.clock.getElapsedTime();
        if (now - lastHoverTimeRef.current > RENDER.interaction.hoverInterval) {
            lastHoverTimeRef.current = now;
            const { prey: preyRef, pred: predRef, food: foodRef } = refs;

            if (preyRef.current && preyRef.current.count > 0) {
                preyRef.current.computeBoundingSphere();
            }
            if (predRef.current && predRef.current.count > 0) {
                predRef.current.computeBoundingSphere();
            }
            if (foodRef.current && foodRef.current.count > 0) {
                foodRef.current.computeBoundingSphere();
            }
        }
    });
};

/**
 * Хук для керування анімацією та оновленням буферів сутностей
 */
const useEntitiesAnimation = (params: AnimationHookParams) => {
    const { refs, engine, speed, isLoading } = params;

    useFrame((state) => {
        const { prey: preyRef, pred: predRef, food: foodRef } = refs;
        if (!preyRef.current || !predRef.current || !foodRef.current) { return; }

        if (speed > 0 && !isLoading) {
            const steps = Math.floor(speed >= 1 ? speed : 1);
            for (let s = 0; s < steps; s++) { engine.update(); }
        }

        PROJ_SCREEN_MATRIX.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        FRUSTUM.setFromProjectionMatrix(PROJ_SCREEN_MATRIX);

        const renderBuffers = engine.getRenderData();
        const now = state.clock.getElapsedTime();

        updateOrganismMesh({
            mesh: preyRef.current,
            data: renderBuffers.prey,
            count: renderBuffers.preyCount,
            scaleMultiplier: engine.config.organismScale
        });

        updateOrganismMesh({
            mesh: predRef.current,
            data: renderBuffers.predators,
            count: renderBuffers.predatorCount,
            scaleMultiplier: engine.config.organismScale
        });

        updateFoodMesh({
            mesh: foodRef.current,
            data: renderBuffers.food,
            count: renderBuffers.foodCount,
            scaleMultiplier: engine.config.foodScale,
            rotationTime: now
        });
    });
};

/**
 * Хук для обробки взаємодії з сутностями
 */
const useEntityInteraction = (engine: SimulationEngine) => {
    const { setHoveredEntity, setTooltipPos } = useSimulation();

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>, type: 'prey' | 'predator' | 'food') => {
        e.stopPropagation();
        if (e.instanceId === undefined) { return; }

        const entity = engine.getEntityByInstanceId(type, e.instanceId);
        if (entity) {
            setHoveredEntity(entity);
            setTooltipPos({ x: e.clientX, y: e.clientY });
        }
    }, [engine, setHoveredEntity, setTooltipPos]);

    const handlePointerOut = useCallback(() => setHoveredEntity(null), [setHoveredEntity]);
    const handlePointerMiss = useCallback(() => setHoveredEntity(null), [setHoveredEntity]);

    return { handlePointerMove, handlePointerOut, handlePointerMiss };
};

export const Entities: React.FC<EntitiesProps> = ({ engine }) => {
    const preyRef = useRef<THREE.InstancedMesh>(null!);
    const predRef = useRef<THREE.InstancedMesh>(null!);
    const foodRef = useRef<THREE.InstancedMesh>(null!);

    const { speed, isLoading } = useSimulation();

    const orgGeo = useMemo(() => {
        const geo = new THREE.ConeGeometry(
            RENDER.geometry.organism.radius,
            RENDER.geometry.organism.height,
            RENDER.geometry.organism.segments
        );
        geo.rotateX(Math.PI / 2); // eslint-disable-line @typescript-eslint/no-magic-numbers
        return geo;
    }, []);

    const foodGeo = useMemo(() => new THREE.SphereGeometry(
        RENDER.geometry.food.radius,
        RENDER.geometry.food.segments,
        RENDER.geometry.food.segments
    ), []);

    useEntitiesAnimation({ refs: { prey: preyRef, pred: predRef, food: foodRef }, engine, speed, isLoading });
    useBoundingVolumesUpdate({ prey: preyRef, pred: predRef, food: foodRef });
    const { handlePointerMove, handlePointerOut, handlePointerMiss } = useEntityInteraction(engine);

    return (
        <group onPointerMissed={handlePointerMiss}>
            <OrganismMesh
                meshRef={preyRef}
                geo={orgGeo}
                color={COLORS.prey.base}
                emissiveIntensity={RENDER.materials.emissiveIntensity.prey}
                shininess={RENDER.materials.shininess.prey}
                onPointerMove={(e) => handlePointerMove(e, 'prey')}
                onPointerOut={handlePointerOut}
            />
            <OrganismMesh
                meshRef={predRef}
                geo={orgGeo}
                color={COLORS.predator.base}
                emissiveIntensity={RENDER.materials.emissiveIntensity.predator}
                shininess={RENDER.materials.shininess.predator}
                onPointerMove={(e) => handlePointerMove(e, 'predator')}
                onPointerOut={handlePointerOut}
            />
            <FoodMesh
                meshRef={foodRef}
                geo={foodGeo}
                onPointerMove={(e) => handlePointerMove(e, 'food')}
                onPointerOut={handlePointerOut}
            />
        </group>
    );
};
