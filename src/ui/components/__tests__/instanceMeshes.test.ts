
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { BUFFER_LAYOUT } from '../../../config';
import { foodBoundingRadius, foodInstanceScale } from '../foodVisuals';
import { ensureInstanceCapacity, writeFoodInstances, writeOrganismInstances } from '../instanceMeshes';

const ORGANISM_STRIDE = BUFFER_LAYOUT.STRIDE;
const FOOD_STRIDE = BUFFER_LAYOUT.FOOD_STRIDE;
const POSITION_TOLERANCE = 1e-4;
const UNIT_SCALE = 1;

interface Body {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly dead?: boolean;
}

// A mix of bodies in view, behind the camera, far to the side, and dead.
const BODIES: Body[] = [
  { id: 11, x: 0, y: 0, z: 0, radius: 1 },
  { id: 12, x: 0, y: 0, z: 200, radius: 1 },
  { id: 13, x: 5, y: 5, z: 10, radius: 1 },
  { id: 14, x: 500, y: 0, z: 0, radius: 1 },
  { id: 15, x: -3, y: 2, z: 1, radius: 1, dead: true },
  { id: 16, x: 2, y: -4, z: 3, radius: 1 },
  { id: 17, x: -6, y: 6, z: -20, radius: 1, dead: true },
  { id: 18, x: 1, y: 1, z: 40, radius: 1 },
];

const camera = (): THREE.PerspectiveCamera => {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  cam.position.set(0, 0, 100);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
};

const frustumOf = (cam: THREE.PerspectiveCamera): THREE.Frustum => {
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  return frustum;
};

const organismBuffer = (bodies: readonly Body[]): Float32Array => {
  const data = new Float32Array(bodies.length * ORGANISM_STRIDE);
  bodies.forEach((body, i) => {
    const o = i * ORGANISM_STRIDE;
    data[o + BUFFER_LAYOUT.OFFSETS.X] = body.x;
    data[o + BUFFER_LAYOUT.OFFSETS.Y] = body.y;
    data[o + BUFFER_LAYOUT.OFFSETS.Z] = body.z;
    data[o + BUFFER_LAYOUT.OFFSETS.RADIUS] = body.radius;
    data[o + BUFFER_LAYOUT.OFFSETS.IS_DEAD] = body.dead === true ? 1 : 0;
    data[o + BUFFER_LAYOUT.OFFSETS.ID] = body.id;
  });
  return data;
};

const foodBuffer = (bodies: readonly Body[]): Float32Array => {
  const data = new Float32Array(bodies.length * FOOD_STRIDE);
  bodies.forEach((body, i) => {
    const o = i * FOOD_STRIDE;
    data[o + BUFFER_LAYOUT.FOOD_OFFSETS.X] = body.x;
    data[o + BUFFER_LAYOUT.FOOD_OFFSETS.Y] = body.y;
    data[o + BUFFER_LAYOUT.FOOD_OFFSETS.Z] = body.z;
    data[o + BUFFER_LAYOUT.FOOD_OFFSETS.RADIUS] = body.radius;
    data[o + BUFFER_LAYOUT.FOOD_OFFSETS.ID] = body.id;
  });
  return data;
};

const positionOf = (mesh: THREE.InstancedMesh, index: number): THREE.Vector3 => {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
};

const bodyWithId = (id: number | undefined): Body => {
  const body = BODIES.find(candidate => candidate.id === id);
  if (!body) throw new Error(`no body with id ${String(id)}`);
  return body;
};

const newOrganismMeshes = (capacity: number): { alive: THREE.InstancedMesh; dead: THREE.InstancedMesh } => {
  const geometry = new THREE.BoxGeometry(UNIT_SCALE, UNIT_SCALE, UNIT_SCALE);
  return {
    alive: new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), capacity),
    dead: new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), capacity),
  };
};

describe('writeOrganismInstances — identity of the instances', () => {
  it('records the entity that each visible instance shows, and only the visible ones', () => {
    const cam = camera();
    const frustum = frustumOf(cam);
    const meshes = newOrganismMeshes(2);
    const aliveIds: number[] = [];
    const deadIds: number[] = [];

    writeOrganismInstances(
      { aliveMesh: meshes.alive, deadMesh: meshes.dead, aliveIds, deadIds },
      { data: organismBuffer(BODIES), count: BODIES.length, scaleMultiplier: UNIT_SCALE, frustum },
    );

    const visible = BODIES.filter(body => frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(body.x, body.y, body.z), body.radius)));
    expect(meshes.alive.count + meshes.dead.count).toBe(visible.length);
    expect(meshes.alive.count).toBe(aliveIds.length);
    expect(meshes.dead.count).toBe(deadIds.length);

    for (let k = 0; k < meshes.alive.count; k++) {
      const body = bodyWithId(aliveIds[k]);
      expect(body.dead).not.toBe(true);
      expect(positionOf(meshes.alive, k).distanceTo(new THREE.Vector3(body.x, body.y, body.z))).toBeLessThan(POSITION_TOLERANCE);
    }
    for (let k = 0; k < meshes.dead.count; k++) {
      const body = bodyWithId(deadIds[k]);
      expect(body.dead).toBe(true);
      expect(positionOf(meshes.dead, k).distanceTo(new THREE.Vector3(body.x, body.y, body.z))).toBeLessThan(POSITION_TOLERANCE);
    }
  });

  it('keeps naming the same entities when the buffer order changes', () => {
    const frustum = frustumOf(camera());
    const meshes = newOrganismMeshes(2);
    const aliveIds: number[] = [];
    const deadIds: number[] = [];
    const reversed = [...BODIES].reverse();

    writeOrganismInstances(
      { aliveMesh: meshes.alive, deadMesh: meshes.dead, aliveIds, deadIds },
      { data: organismBuffer(reversed), count: reversed.length, scaleMultiplier: UNIT_SCALE, frustum },
    );

    for (let k = 0; k < meshes.alive.count; k++) {
      const body = bodyWithId(aliveIds[k]);
      expect(positionOf(meshes.alive, k).distanceTo(new THREE.Vector3(body.x, body.y, body.z))).toBeLessThan(POSITION_TOLERANCE);
    }
  });

  it('grows the instance buffers when a snapshot holds more entities than they were made for', () => {
    const frustum = frustumOf(camera());
    const meshes = newOrganismMeshes(2);
    const many = Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, x: 0, y: 0, z: i * 0.1, radius: 1 }));

    writeOrganismInstances(
      { aliveMesh: meshes.alive, deadMesh: meshes.dead, aliveIds: [], deadIds: [] },
      { data: organismBuffer(many), count: many.length, scaleMultiplier: UNIT_SCALE, frustum },
    );

    expect(meshes.alive.instanceMatrix.count).toBeGreaterThanOrEqual(many.length);
    expect(meshes.alive.count).toBe(many.length);
  });
});

describe('writeFoodInstances — identity of the instances', () => {
  it('records the food item that each visible instance shows', () => {
    const frustum = frustumOf(camera());
    const food = BODIES.map(body => ({ ...body, radius: UNIT_SCALE }));
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(UNIT_SCALE), new THREE.MeshBasicMaterial(), 2);
    const ids: number[] = [];

    writeFoodInstances(
      { mesh, ids },
      { data: foodBuffer(food), count: food.length, scaleMultiplier: UNIT_SCALE, frustum, rotationTime: 0 },
    );

    const visible = food.filter(item => {
      const instanceScale = foodInstanceScale(item.radius, UNIT_SCALE);
      return frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(item.x, item.y, item.z), foodBoundingRadius(instanceScale)));
    });
    expect(mesh.count).toBe(visible.length);
    expect(ids.length).toBe(visible.length);
    for (let k = 0; k < mesh.count; k++) {
      const item = bodyWithId(ids[k]);
      expect(positionOf(mesh, k).distanceTo(new THREE.Vector3(item.x, item.y, item.z))).toBeLessThan(POSITION_TOLERANCE);
    }
  });
});

describe('ensureInstanceCapacity', () => {
  it('leaves a mesh alone when it is already large enough', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 8);
    const before = mesh.instanceMatrix;

    ensureInstanceCapacity(mesh, 8);

    expect(mesh.instanceMatrix).toBe(before);
  });

  it('grows a mesh to hold the number needed, with room to spare', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);

    ensureInstanceCapacity(mesh, 9);

    expect(mesh.instanceMatrix.count).toBeGreaterThanOrEqual(9);
  });
});
