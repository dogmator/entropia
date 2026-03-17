import { describe, expect, it } from 'vitest';

import type { RenderBuffers } from '@/types';

import { snapshotRenderBuffers } from '../workerSnapshot';

function createBuffers(): RenderBuffers {
    return {
        prey: new Float32Array(26),
        preyCount: 1,
        predators: new Float32Array(26),
        predatorCount: 1,
        food: new Float32Array(15),
        foodCount: 1,
    };
}

describe('snapshotRenderBuffers', () => {
    it('creates compact transferable copies for non-shared buffers', () => {
        const source = createBuffers();
        source.prey[0] = 10;
        source.predators[0] = 20;
        source.food[0] = 30;

        const { buffers, transferables } = snapshotRenderBuffers(source);

        expect(buffers.prey.length).toBe(13);
        expect(buffers.predators.length).toBe(13);
        expect(buffers.food.length).toBe(5);
        expect(buffers.prey[0]).toBe(10);
        expect(buffers.predators[0]).toBe(20);
        expect(buffers.food[0]).toBe(30);
        expect(buffers.prey.buffer).not.toBe(source.prey.buffer);
        expect(transferables).toHaveLength(3);
    });

    it('does not transfer shared buffers', () => {
        if (typeof SharedArrayBuffer === 'undefined') {
            return;
        }

        const shared = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 26);
        const prey = new Float32Array(shared, 0, 26);
        const predators = new Float32Array(shared, 0, 26);
        const food = new Float32Array(shared, 0, 15);

        const source: RenderBuffers = {
            prey,
            preyCount: 1,
            predators,
            predatorCount: 1,
            food,
            foodCount: 1,
            sharedBuffer: shared,
        };

        const { buffers, transferables } = snapshotRenderBuffers(source);

        expect(buffers.prey.buffer).toBe(shared);
        expect(buffers.predators.buffer).toBe(shared);
        expect(buffers.food.buffer).toBe(shared);
        expect(transferables).toHaveLength(0);
    });
});
