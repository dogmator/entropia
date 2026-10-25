import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { COLORS, RENDER } from '../../config';
import type { RenderedKind } from '../../shared/interfaces/RenderedKind';
import type { ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import { useSimulation } from '../context/SimulationContext';
import { writeFoodInstances, writeOrganismInstances } from './instanceMeshes';
import { type HoverTarget,LiveHoverSession } from './LiveHoverSession';

const MATRIX_ELEMENT_COUNT = 16;
const MATRIX_CHANGE_EPSILON = 1e-6;
const HOVER_REFRESH_SECONDS = 0.25;

const PROJ_SCREEN_MATRIX = new THREE.Matrix4();
const FRUSTUM = new THREE.Frustum();

/** The meshes Entities draws. A hover resolves an entity through the role of the mesh it hit. */
type MeshRole = 'prey' | 'deadPrey' | 'pred' | 'deadPred' | 'food';

const HOVER_TARGETS: Record<MeshRole, { kind: RenderedKind; isDead: boolean }> = {
    prey: { kind: 'prey', isDead: false },
    deadPrey: { kind: 'prey', isDead: true },
    pred: { kind: 'predator', isDead: false },
    deadPred: { kind: 'predator', isDead: true },
    food: { kind: 'food', isDead: false },
};

/** The numeric entity id of each instance a mesh shows, in instance order. */
type InstanceIds = Record<MeshRole, number[]>;

interface OrganismMeshProps {
    meshRef: React.RefObject<THREE.InstancedMesh | null>;
    geo: THREE.BufferGeometry;
    color: number;
    emissiveIntensity: number;
    shininess: number;
    onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
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
    ids: InstanceIds;
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

const setMaterialOpacity = (meshes: (THREE.InstancedMesh | null)[], opacity: number): void => {
    for (const mesh of meshes) {
        if (mesh) (mesh.material as THREE.MeshPhongMaterial).opacity = opacity;
    }
};

interface OpacityState { organism: number; food: number }

/** Applies the body and resource opacity of the settings to the materials, when either has changed since the last frame. */
const syncOpacity = (refs: AnimationRefs, config: OpacityState, lastRef: { current: OpacityState | null }): void => {
    const last = lastRef.current;
    if (last?.organism === config.organism && last.food === config.food) return;
    lastRef.current = { organism: config.organism, food: config.food };
    setMaterialOpacity([refs.prey.current, refs.deadPrey.current, refs.pred.current, refs.deadPred.current], config.organism);
    setMaterialOpacity([refs.food.current], config.food);
};

/** The view frustum of the camera, which decides which instances are written. */
const updateFrustum = (camera: THREE.Camera): void => {
    PROJ_SCREEN_MATRIX.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    FRUSTUM.setFromProjectionMatrix(PROJ_SCREEN_MATRIX);
};

/** Updates the glow of the prey and predator materials when the setting has changed since the last frame. */
const syncGlow = (refs: AnimationRefs, isEnabled: boolean, lastRef: { current: boolean | null }): void => {
    if (lastRef.current === isEnabled) return;
    lastRef.current = isEnabled;
    updateGlowIntensity(refs, isEnabled);
};

/**
 * Hook for managing animation and entity buffer updates
 */
const useEntitiesAnimation = (params: AnimationHookParams): void => {
    const { refs, engine, ids } = params;
    const lastShowGlowRef = useRef<boolean | null>(null);
    const lastOpacityRef = useRef<OpacityState | null>(null);
    const lastBuffersRef = useRef<object | null>(null);
    const prevCamElemsRef = useRef(new Float32Array(MATRIX_ELEMENT_COUNT));

    useFrame((state) => {
        if (!refs.prey.current || !refs.deadPrey.current || !refs.pred.current || !refs.deadPred.current || !refs.food.current) return;

        updateFrustum(state.camera);

        const renderBuffers = engine.getRenderData();
        const isNewBuffers = renderBuffers !== lastBuffersRef.current;
        lastBuffersRef.current = renderBuffers;

        const isCameraChanged = checkCameraChange(prevCamElemsRef.current, PROJ_SCREEN_MATRIX.elements);

        if (isNewBuffers || isCameraChanged) {
            writeOrganismInstances(
                { aliveMesh: refs.prey.current, deadMesh: refs.deadPrey.current, aliveIds: ids.prey, deadIds: ids.deadPrey },
                { data: renderBuffers.prey, count: renderBuffers.preyCount, scaleMultiplier: engine.config.organismScale, frustum: FRUSTUM },
            );
            writeOrganismInstances(
                { aliveMesh: refs.pred.current, deadMesh: refs.deadPred.current, aliveIds: ids.pred, deadIds: ids.deadPred },
                { data: renderBuffers.predators, count: renderBuffers.predatorCount, scaleMultiplier: engine.config.organismScale, frustum: FRUSTUM },
            );
        }

        writeFoodInstances(
            { mesh: refs.food.current, ids: ids.food },
            { data: renderBuffers.food, count: renderBuffers.foodCount, scaleMultiplier: engine.config.foodScale, frustum: FRUSTUM, rotationTime: state.clock.getElapsedTime() },
        );

        syncOpacity(refs, { organism: engine.config.organismOpacity, food: engine.config.foodOpacity }, lastOpacityRef);

        syncGlow(refs, engine.config.showEnergyGlow, lastShowGlowRef);
    });
};

const useBoundingSphereUpdates = (refs: AnimationRefs): void => {
    const lastBoundingUpdateRef = useRef(0);

    useFrame((state) => {
        const now = state.clock.getElapsedTime();
        if (now - lastBoundingUpdateRef.current < RENDER.interaction.hoverInterval) return;

        lastBoundingUpdateRef.current = now;
        [refs.prey, refs.deadPrey, refs.pred, refs.deadPred, refs.food].forEach((ref) => {
            if (ref.current && ref.current.count > 0) {
                ref.current.computeBoundingSphere();
            }
        });
    });
};

/** The shared geometries of the organisms and of the food. */
const useEntityGeometries = (): { orgGeo: THREE.BufferGeometry; foodGeo: THREE.BufferGeometry } => {
    const orgGeo = useMemo(() => {
        const geo = new THREE.ConeGeometry(RENDER.geometry.organism.radius, RENDER.geometry.organism.height, RENDER.geometry.organism.segments);
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        geo.rotateX(Math.PI / 2); // tip → +Z so setFromUnitVectors(FORWARD, vel) aligns tip with velocity
        return geo;
    }, []);
    const foodGeo = useMemo(() => new THREE.IcosahedronGeometry(RENDER.geometry.food.radius), []);
    return { orgGeo, foodGeo };
};

// eslint-disable-next-line max-lines-per-function -- hovering requires the current mesh instance IDs and the scene frame loop
export const Entities: React.FC = () => {
    const { engine, setHoveredEntity, setTooltipPos, worldRevision } = useSimulation();

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

    const ids = useMemo<InstanceIds>(() => ({
        prey: [], deadPrey: [], pred: [], deadPred: [], food: []
    }), []);

    useEntitiesAnimation({ refs, engine, ids });
    useBoundingSphereUpdates(refs);

    const session = useMemo(() => new LiveHoverSession(
        (kind, numericId, isDead) => engine.getEntityByNumericId(kind, numericId, isDead),
        setHoveredEntity,
        (error) => { console.error('Failed to get entity info:', error); },
    ), [engine, setHoveredEntity]);

    const lastHoverRefreshRef = useRef(0);
    const lastWorldRevisionRef = useRef(worldRevision);
    useFrame(({ clock }) => {
        if (lastWorldRevisionRef.current !== worldRevision) {
            lastWorldRevisionRef.current = worldRevision;
            session.clear();
        }
        const now = clock.getElapsedTime();
        if (now - lastHoverRefreshRef.current < HOVER_REFRESH_SECONDS) return;
        lastHoverRefreshRef.current = now;
        session.refresh();
    });

    // Reset/import can reuse entity IDs. Never retain a tooltip belonging to the replaced world.
    useEffect(() => {
        const unsubscribe = engine.addEventListener(event => {
            if (event.type === 'TickUpdated' && event.tick === 0) session.clear();
        });
        return () => { unsubscribe(); session.dispose(); };
    }, [engine, session]);

    const targetFromEvent = useCallback((e: ThreeEvent<PointerEvent>, role: MeshRole): HoverTarget | null => {
        if (e.instanceId === undefined) return null;
        const numericId = ids[role][e.instanceId];
        if (numericId === undefined) return null;
        return { ...HOVER_TARGETS[role], numericId, role };
    }, [ids]);

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>, role: MeshRole) => {
        e.stopPropagation();
        const target = targetFromEvent(e, role);
        if (!target) return;
        session.move(target);
        setTooltipPos({ x: e.clientX, y: e.clientY });
    }, [session, targetFromEvent, setTooltipPos]);

    const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>, role: MeshRole) => {
        const target = targetFromEvent(e, role);
        if (target) session.leave(target);
        else session.clear();
    }, [session, targetFromEvent]);

    const { orgGeo, foodGeo } = useEntityGeometries();

    return (
        <group>
            <OrganismMesh meshRef={preyRef} geo={orgGeo} color={COLORS.prey.base} emissiveIntensity={RENDER.materials.emissiveIntensity.prey} shininess={RENDER.materials.shininess.prey} onPointerMove={(e) => { handlePointerMove(e, 'prey'); }} onPointerOut={(e) => { handlePointerOut(e, 'prey'); }} />
            <OrganismMesh meshRef={deadPreyRef} geo={orgGeo} color={COLORS.prey.death} emissiveIntensity={0} shininess={RENDER.materials.shininess.dead} onPointerMove={(e) => { handlePointerMove(e, 'deadPrey'); }} onPointerOut={(e) => { handlePointerOut(e, 'deadPrey'); }} />
            <OrganismMesh meshRef={predRef} geo={orgGeo} color={COLORS.predator.base} emissiveIntensity={RENDER.materials.emissiveIntensity.predator} shininess={RENDER.materials.shininess.predator} onPointerMove={(e) => { handlePointerMove(e, 'pred'); }} onPointerOut={(e) => { handlePointerOut(e, 'pred'); }} />
            <OrganismMesh meshRef={deadPredRef} geo={orgGeo} color={COLORS.predator.death} emissiveIntensity={0} shininess={RENDER.materials.shininess.dead} onPointerMove={(e) => { handlePointerMove(e, 'deadPred'); }} onPointerOut={(e) => { handlePointerOut(e, 'deadPred'); }} />

            <instancedMesh ref={foodRef} args={[foodGeo, undefined, RENDER.maxInstances * RENDER.foodInstanceMultiplier]} frustumCulled={false} onPointerMove={(e) => { handlePointerMove(e, 'food'); }} onPointerOut={(e) => { handlePointerOut(e, 'food'); }}>
                <meshPhongMaterial color={COLORS.food.base} emissive={COLORS.food.base} emissiveIntensity={RENDER.materials.emissiveIntensity.food} shininess={RENDER.materials.shininess.food} transparent />
            </instancedMesh>
        </group>
    );
};
