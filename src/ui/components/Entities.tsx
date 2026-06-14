import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BUFFER_LAYOUT, COLORS, RENDER } from '../../config';
import type { ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import { useSimulation } from '../context/SimulationContext';

const FORWARD = new THREE.Vector3(0, 0, 1);
const DUMMY = new THREE.Object3D();
const TMP_SPHERE = new THREE.Sphere();
const TMP_POS = new THREE.Vector3();
const PROJ_SCREEN_MATRIX = new THREE.Matrix4();
const FRUSTUM = new THREE.Frustum();
const MATRIX_ELEMENT_COUNT = 16;
const MATRIX_CHANGE_EPSILON = 1e-6;
const DEFAULT_RADIUS = 1;
const ROTATION_OFFSET = 0.5;

interface UpdateMeshParams {
    mesh: THREE.InstancedMesh;
    data: Float32Array;
    count: number;
    scaleMultiplier: number;
    rotationTime?: number;
}

const setOrganismTransform = (data: Float32Array, offset: number, radius: number): void => {
    const vx = data[offset + BUFFER_LAYOUT.OFFSETS.VX] ?? 0;
    const vy = data[offset + BUFFER_LAYOUT.OFFSETS.VY] ?? 0;
    const vz = data[offset + BUFFER_LAYOUT.OFFSETS.VZ] ?? 0;

    DUMMY.position.set(
        data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0,
        data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0,
        data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0
    );
    DUMMY.scale.setScalar(radius);

    const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (spd > RENDER.geometry.velocityThreshold) {
        TMP_POS.set(vx / spd, vy / spd, vz / spd);
        DUMMY.quaternion.setFromUnitVectors(FORWARD, TMP_POS);
    } else {
        DUMMY.rotation.set(0, 0, 0);
    }
    DUMMY.updateMatrix();
};

const updateOrganismMeshes = (params: {
    aliveMesh: THREE.InstancedMesh;
    deadMesh: THREE.InstancedMesh;
    data: Float32Array;
    count: number;
    scaleMultiplier: number;
}): void => {
    const { aliveMesh, deadMesh, data, count, scaleMultiplier } = params;
    let aliveCount = 0;
    let deadCount = 0;

    for (let i = 0; i < count; i++) {
        const offset = i * BUFFER_LAYOUT.STRIDE;
        const radius = (data[offset + BUFFER_LAYOUT.OFFSETS.RADIUS] ?? DEFAULT_RADIUS) * scaleMultiplier;
        TMP_POS.set(data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0, data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0, data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0);
        TMP_SPHERE.set(TMP_POS, radius);
        if (!FRUSTUM.intersectsSphere(TMP_SPHERE)) continue;

        setOrganismTransform(data, offset, radius);
        const isDead = (data[offset + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD;
        if (isDead) deadMesh.setMatrixAt(deadCount++, DUMMY.matrix);
        else aliveMesh.setMatrixAt(aliveCount++, DUMMY.matrix);
    }

    aliveMesh.count = aliveCount;
    deadMesh.count = deadCount;
    aliveMesh.instanceMatrix.needsUpdate = true;
    deadMesh.instanceMatrix.needsUpdate = true;
};

const updateFoodMesh = (params: UpdateMeshParams): void => {
    const { mesh, data, count, scaleMultiplier, rotationTime = 0 } = params;
    let visibleCount = 0;

    for (let i = 0; i < count; i++) {
        const offset = i * BUFFER_LAYOUT.FOOD_STRIDE;
        const radius = (data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.RADIUS] ?? DEFAULT_RADIUS) * scaleMultiplier;
        TMP_POS.set(data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.X] ?? 0, data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.Y] ?? 0, data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.Z] ?? 0);
        TMP_SPHERE.set(TMP_POS, radius);
        if (!FRUSTUM.intersectsSphere(TMP_SPHERE)) continue;

        DUMMY.position.copy(TMP_POS);
        DUMMY.scale.setScalar(radius);
        DUMMY.rotation.set(rotationTime, rotationTime * ROTATION_OFFSET, 0);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(visibleCount++, DUMMY.matrix);
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
};

interface OrganismMeshProps {
    meshRef: React.RefObject<THREE.InstancedMesh | null>;
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

interface AnimationRefs {
    prey: React.RefObject<THREE.InstancedMesh | null>;
    deadPrey: React.RefObject<THREE.InstancedMesh | null>;
    pred: React.RefObject<THREE.InstancedMesh | null>;
    deadPred: React.RefObject<THREE.InstancedMesh | null>;
    food: React.RefObject<THREE.InstancedMesh | null>;
}

interface AnimationHookParams {
    refs: AnimationRefs;
    engine: ISimulationEngine;
}

const checkCameraChange = (prevElems: Float32Array, currElems: number[]): boolean => {
    let isChanged = false;
    for (let i = 0; i < MATRIX_ELEMENT_COUNT; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (Math.abs(currElems[i]! - prevElems[i]!) > MATRIX_CHANGE_EPSILON) {
            isChanged = true;
            break;
        }
    }
    if (isChanged) prevElems.set(currElems);
    return isChanged;
};

const updateGlowIntensity = (refs: AnimationRefs, isEnabled: boolean): void => {
    const preyMesh = refs.prey.current;
    const predMesh = refs.pred.current;
    if (preyMesh) {
        (preyMesh.material as THREE.MeshPhongMaterial).emissiveIntensity = isEnabled ? RENDER.materials.emissiveIntensity.prey : 0;
    }
    if (predMesh) {
        (predMesh.material as THREE.MeshPhongMaterial).emissiveIntensity = isEnabled ? RENDER.materials.emissiveIntensity.predator : 0;
    }
};

/**
 * Hook for managing animation and entity buffer updates
 */
const useEntitiesAnimation = (params: AnimationHookParams): void => {
    const { refs, engine } = params;
    const lastShowGlowRef = useRef<boolean | null>(null);
    const lastBuffersRef = useRef<object | null>(null);
    const prevCamElemsRef = useRef(new Float32Array(MATRIX_ELEMENT_COUNT));

    useFrame((state) => {
        if (!refs.prey.current || !refs.deadPrey.current || !refs.pred.current || !refs.deadPred.current || !refs.food.current) return;

        PROJ_SCREEN_MATRIX.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        FRUSTUM.setFromProjectionMatrix(PROJ_SCREEN_MATRIX);

        const renderBuffers = engine.getRenderData();
        const isNewBuffers = renderBuffers !== lastBuffersRef.current;
        lastBuffersRef.current = renderBuffers;

        const isCameraChanged = checkCameraChange(prevCamElemsRef.current, PROJ_SCREEN_MATRIX.elements);

        if (isNewBuffers || isCameraChanged) {
            updateOrganismMeshes({ aliveMesh: refs.prey.current, deadMesh: refs.deadPrey.current, data: renderBuffers.prey, count: renderBuffers.preyCount, scaleMultiplier: engine.config.organismScale });
            updateOrganismMeshes({ aliveMesh: refs.pred.current, deadMesh: refs.deadPred.current, data: renderBuffers.predators, count: renderBuffers.predatorCount, scaleMultiplier: engine.config.organismScale });
        }

        updateFoodMesh({ mesh: refs.food.current, data: renderBuffers.food, count: renderBuffers.foodCount, scaleMultiplier: engine.config.foodScale, rotationTime: state.clock.getElapsedTime() });

        if (lastShowGlowRef.current !== engine.config.showEnergyGlow) {
            lastShowGlowRef.current = engine.config.showEnergyGlow;
            updateGlowIntensity(refs, engine.config.showEnergyGlow);
        }
    });
};

export const Entities: React.FC = () => {
    const { engine, setHoveredEntity, setTooltipPos } = useSimulation();

    const preyRef = useRef<THREE.InstancedMesh>(null);
    const deadPreyRef = useRef<THREE.InstancedMesh>(null);
    const predRef = useRef<THREE.InstancedMesh>(null);
    const deadPredRef = useRef<THREE.InstancedMesh>(null);
    const foodRef = useRef<THREE.InstancedMesh>(null);

    const refs = useMemo(() => ({
        prey: preyRef, deadPrey: deadPreyRef,
        pred: predRef, deadPred: deadPredRef,
        food: foodRef
    }), []);

    useEntitiesAnimation({ refs, engine });

    // Periodically recompute bounding spheres so r3f raycasting stays accurate for instanced meshes
    const lastBoundingUpdateRef = useRef(0);
    useFrame((state) => {
        const now = state.clock.getElapsedTime();
        if (now - lastBoundingUpdateRef.current < RENDER.interaction.hoverInterval) return;
        lastBoundingUpdateRef.current = now;
        [preyRef, deadPreyRef, predRef, deadPredRef, foodRef].forEach(ref => {
            if (ref.current && ref.current.count > 0) ref.current.computeBoundingSphere();
        });
    });

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>, entityType: string) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
            engine.getEntityByInstanceId(entityType, e.instanceId, entityType.includes('dead'))
                .then(entity => {
                    if (entity) {
                        setHoveredEntity(entity);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                    }
                })
                .catch((err: unknown) => { console.error('Failed to get entity info:', err); });
        }
    }, [engine, setHoveredEntity, setTooltipPos]);

    const handlePointerOut = useCallback(() => { setHoveredEntity(null); }, [setHoveredEntity]);

    const orgGeo = useMemo(() => {
        const geo = new THREE.ConeGeometry(RENDER.geometry.organism.radius, RENDER.geometry.organism.height, RENDER.geometry.organism.segments);
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        geo.rotateX(Math.PI / 2); // tip → +Z so setFromUnitVectors(FORWARD, vel) aligns tip with velocity
        return geo;
    }, []);
    const foodGeo = useMemo(() => new THREE.IcosahedronGeometry(RENDER.geometry.food.radius), []);

    return (
        <group>
            <OrganismMesh meshRef={preyRef} geo={orgGeo} color={COLORS.prey.base} emissiveIntensity={RENDER.materials.emissiveIntensity.prey} shininess={RENDER.materials.shininess.prey} onPointerMove={(e) => { handlePointerMove(e, 'prey'); }} onPointerOut={handlePointerOut} />
            <OrganismMesh meshRef={deadPreyRef} geo={orgGeo} color={COLORS.prey.death} emissiveIntensity={0} shininess={RENDER.materials.shininess.dead} onPointerMove={(e) => { handlePointerMove(e, 'dead_prey'); }} onPointerOut={handlePointerOut} />
            <OrganismMesh meshRef={predRef} geo={orgGeo} color={COLORS.predator.base} emissiveIntensity={RENDER.materials.emissiveIntensity.predator} shininess={RENDER.materials.shininess.predator} onPointerMove={(e) => { handlePointerMove(e, 'predator'); }} onPointerOut={handlePointerOut} />
            <OrganismMesh meshRef={deadPredRef} geo={orgGeo} color={COLORS.predator.death} emissiveIntensity={0} shininess={RENDER.materials.shininess.dead} onPointerMove={(e) => { handlePointerMove(e, 'dead_predator'); }} onPointerOut={handlePointerOut} />

            <instancedMesh ref={foodRef} args={[foodGeo, undefined, RENDER.maxInstances * RENDER.foodInstanceMultiplier]} frustumCulled={false} onPointerMove={(e) => { handlePointerMove(e, 'food'); }} onPointerOut={handlePointerOut}>
                <meshPhongMaterial color={COLORS.food.base} emissive={COLORS.food.base} emissiveIntensity={RENDER.materials.emissiveIntensity.food} shininess={RENDER.materials.shininess.food} transparent />
            </instancedMesh>
        </group>
    );
};
