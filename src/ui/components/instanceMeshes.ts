/**
 * Writes render buffers into instanced meshes.
 *
 * Only the instances inside the camera frustum are written, so an instance index is a position among the visible entities
 * and says nothing about where the entity sits in the buffer. Each written instance also records the entity's numeric id,
 * which is what a hover resolves. A mesh grows when a snapshot holds more entities than it was created for.
 */
import * as THREE from 'three';

import { BUFFER_LAYOUT, RENDER } from '../../config';
import { foodBoundingRadius, foodInstanceScale } from './foodVisuals';

const DEFAULT_RADIUS = 1;
const ROTATION_OFFSET = 0.5;
const MATRIX_ELEMENT_COUNT = 16;
const CAPACITY_GROWTH_FACTOR = 2;

const FORWARD = new THREE.Vector3(0, 0, 1);
const DUMMY = new THREE.Object3D();
const TMP_SPHERE = new THREE.Sphere();
const TMP_POS = new THREE.Vector3();

export interface VisibleSource {
    readonly data: Float32Array;
    readonly count: number;
    readonly scaleMultiplier: number;
    readonly frustum: THREE.Frustum;
}

export interface OrganismTargets {
    readonly aliveMesh: THREE.InstancedMesh;
    readonly deadMesh: THREE.InstancedMesh;
    readonly aliveIds: number[];
    readonly deadIds: number[];
}

export interface FoodTarget {
    readonly mesh: THREE.InstancedMesh;
    readonly ids: number[];
}

/** Makes the mesh able to hold `needed` instances, growing its matrix buffer when it cannot. */
export const ensureInstanceCapacity = (mesh: THREE.InstancedMesh, needed: number): void => {
    const capacity = mesh.instanceMatrix.count;
    if (needed <= capacity) return;
    const grown = Math.max(needed, capacity * CAPACITY_GROWTH_FACTOR);
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(grown * MATRIX_ELEMENT_COUNT), MATRIX_ELEMENT_COUNT);
};

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

export const writeOrganismInstances = (target: OrganismTargets, source: VisibleSource): void => {
    const { aliveMesh, deadMesh, aliveIds, deadIds } = target;
    const { data, count, scaleMultiplier, frustum } = source;
    ensureInstanceCapacity(aliveMesh, count);
    ensureInstanceCapacity(deadMesh, count);
    aliveIds.length = 0;
    deadIds.length = 0;

    let aliveCount = 0;
    let deadCount = 0;
    for (let i = 0; i < count; i++) {
        const offset = i * BUFFER_LAYOUT.STRIDE;
        const radius = (data[offset + BUFFER_LAYOUT.OFFSETS.RADIUS] ?? DEFAULT_RADIUS) * scaleMultiplier;
        TMP_POS.set(data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0, data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0, data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0);
        TMP_SPHERE.set(TMP_POS, radius);
        if (!frustum.intersectsSphere(TMP_SPHERE)) continue;

        setOrganismTransform(data, offset, radius);
        const numericId = data[offset + BUFFER_LAYOUT.OFFSETS.ID] ?? 0;
        const isDead = (data[offset + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD;
        if (isDead) {
            deadMesh.setMatrixAt(deadCount++, DUMMY.matrix);
            deadIds.push(numericId);
        } else {
            aliveMesh.setMatrixAt(aliveCount++, DUMMY.matrix);
            aliveIds.push(numericId);
        }
    }

    aliveMesh.count = aliveCount;
    deadMesh.count = deadCount;
    aliveMesh.instanceMatrix.needsUpdate = true;
    deadMesh.instanceMatrix.needsUpdate = true;
};

export const writeFoodInstances = (target: FoodTarget, source: VisibleSource & { readonly rotationTime: number }): void => {
    const { mesh, ids } = target;
    const { data, count, scaleMultiplier, frustum, rotationTime } = source;
    ensureInstanceCapacity(mesh, count);
    ids.length = 0;

    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
        const offset = i * BUFFER_LAYOUT.FOOD_STRIDE;
        const instanceScale = foodInstanceScale(data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.RADIUS] ?? DEFAULT_RADIUS, scaleMultiplier);
        TMP_POS.set(data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.X] ?? 0, data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.Y] ?? 0, data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.Z] ?? 0);
        TMP_SPHERE.set(TMP_POS, foodBoundingRadius(instanceScale));
        if (!frustum.intersectsSphere(TMP_SPHERE)) continue;

        DUMMY.position.copy(TMP_POS);
        DUMMY.scale.setScalar(instanceScale);
        DUMMY.rotation.set(rotationTime, rotationTime * ROTATION_OFFSET, 0);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(visibleCount++, DUMMY.matrix);
        ids.push(data[offset + BUFFER_LAYOUT.FOOD_OFFSETS.ID] ?? 0);
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
};
