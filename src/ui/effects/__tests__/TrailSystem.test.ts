import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { TrailSystem } from '../ParticleSystem';

interface TrailDebugView {
  geometry: THREE.BufferGeometry;
}

interface TrailSystemDebugView {
  trails: Map<string, TrailDebugView>;
}

const getTrailDebug = (system: TrailSystem): TrailSystemDebugView =>
  system as unknown as TrailSystemDebugView;

describe('TrailSystem', () => {
  it('retains only latest points when trail exceeds max length', () => {
    const scene = new THREE.Scene();
    const system = new TrailSystem(scene, 3);

    system.beginFrame();
    system.updateTrail('prey_1', { position: { x: 1, y: 0, z: 0 }, color: 0x00ff00, enabled: true });
    system.updateTrail('prey_1', { position: { x: 2, y: 0, z: 0 }, color: 0x00ff00, enabled: true });
    system.updateTrail('prey_1', { position: { x: 3, y: 0, z: 0 }, color: 0x00ff00, enabled: true });
    system.updateTrail('prey_1', { position: { x: 4, y: 0, z: 0 }, color: 0x00ff00, enabled: true });

    const trail = getTrailDebug(system).trails.get('prey_1');
    expect(trail).toBeDefined();

    const positionAttr = trail?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const positionArray = positionAttr?.array as Float32Array | undefined;
    expect(positionArray).toBeDefined();

    const x0 = positionArray?.[0];
    const x1 = positionArray?.[3];
    const x2 = positionArray?.[6];
    expect(x0).toBe(2);
    expect(x1).toBe(3);
    expect(x2).toBe(4);
  });

  it('prunes trails that were not updated in current frame', () => {
    const scene = new THREE.Scene();
    const system = new TrailSystem(scene, 8);

    system.beginFrame();
    system.updateTrail('prey_2', { position: { x: 1, y: 1, z: 1 }, color: 0x00ff00, enabled: true });
    expect(getTrailDebug(system).trails.size).toBe(1);

    system.beginFrame();
    system.prune();
    expect(getTrailDebug(system).trails.size).toBe(0);
  });
});
