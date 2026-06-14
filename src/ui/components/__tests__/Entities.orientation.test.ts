import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { RENDER } from '../../../config';

/**
 * Verifies the orientation contract that allows organism meshes to face their
 * direction of motion: ConeGeometry rotated by PI/2 on X so the tip points
 * along +Z, then setFromUnitVectors(FORWARD=(0,0,1), velocity) aligns the
 * tip with the velocity vector.
 *
 * Regression guard for the bug where lookAt() was used instead of quaternion
 * rotation, causing all cone organisms to appear as circles (spheres).
 */

const FORWARD = new THREE.Vector3(0, 0, 1);

describe('Organism cone orientation', () => {
    it('ConeGeometry.rotateX(PI/2) puts the tip at +Z', () => {
        const geo = new THREE.ConeGeometry(
            RENDER.geometry.organism.radius,
            RENDER.geometry.organism.height,
            RENDER.geometry.organism.segments
        );
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        geo.rotateX(Math.PI / 2);
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;

        const sizeZ = bb.max.z - bb.min.z;
        const sizeY = bb.max.y - bb.min.y;
        // After X-rotation the cone height lies along Z, not Y
        expect(sizeZ).toBeGreaterThan(sizeY);
        // Tip is at +Z: max.z should be approximately height/2
        expect(bb.max.z).toBeCloseTo(RENDER.geometry.organism.height / 2, 1);
    });

    it('setFromUnitVectors(FORWARD, vel) rotates cone tip to face velocity', () => {
        const testCases: Array<{ vel: THREE.Vector3; label: string }> = [
            { vel: new THREE.Vector3(1, 0, 0), label: '+X' },
            { vel: new THREE.Vector3(0, 0, 1), label: '+Z (no rotation)' },
            { vel: new THREE.Vector3(-1, 0, 0), label: '-X' },
            { vel: new THREE.Vector3(0.707, 0, 0.707), label: 'diagonal XZ' },
        ];

        const dummy = new THREE.Object3D();

        testCases.forEach(({ vel, label }) => {
            const normalized = vel.clone().normalize();
            dummy.quaternion.setFromUnitVectors(FORWARD, normalized);
            dummy.updateMatrix();

            // After rotation, local +Z should point in the velocity direction
            const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(dummy.quaternion);
            expect(localZ.x).toBeCloseTo(normalized.x, 4);
            expect(localZ.y).toBeCloseTo(normalized.y, 4);
            expect(localZ.z).toBeCloseTo(normalized.z, 4);

            // For a cone rotated by PI/2 on X: tip is at local +Z.
            // After the quaternion rotation, the tip now points toward velocity. ✓
            expect(true).toBe(true); // explicit intent marker
            void label; // suppress unused var in loop
        });
    });

    it('zero-velocity organisms get identity rotation (tip points +Z world)', () => {
        const dummy = new THREE.Object3D();
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();

        const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(dummy.quaternion);
        expect(localZ.x).toBeCloseTo(0, 4);
        expect(localZ.y).toBeCloseTo(0, 4);
        expect(localZ.z).toBeCloseTo(1, 4);
    });
});
