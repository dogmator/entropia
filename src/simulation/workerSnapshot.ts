import type { RenderBuffers } from '@/types';

const PREY_STRIDE = 13;
const PREDATOR_STRIDE = 13;
const FOOD_STRIDE = 5;

interface SnapshotResult {
    buffers: RenderBuffers;
    transferables: Transferable[];
}

function getUsedLength(totalLength: number, count: number, stride: number): number {
    const requiredLength = Math.max(0, count * stride);
    return Math.min(totalLength, requiredLength);
}

function snapshotTypedArray(
    source: Float32Array,
    usedLength: number,
    transferables: Transferable[]
): Float32Array {
    const boundedView = source.subarray(0, usedLength);
    const isSharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';

    if (isSharedArrayBufferSupported && boundedView.buffer instanceof SharedArrayBuffer) {
        return boundedView;
    }

    const cloned = new Float32Array(boundedView);
    transferables.push(cloned.buffer);
    return cloned;
}

export function snapshotRenderBuffers(source: RenderBuffers): SnapshotResult {
    const transferables: Transferable[] = [];

    const preyLength = getUsedLength(source.prey.length, source.preyCount, PREY_STRIDE);
    const predatorLength = getUsedLength(source.predators.length, source.predatorCount, PREDATOR_STRIDE);
    const foodLength = getUsedLength(source.food.length, source.foodCount, FOOD_STRIDE);

    const buffers: RenderBuffers = {
        prey: snapshotTypedArray(source.prey, preyLength, transferables),
        preyCount: source.preyCount,
        predators: snapshotTypedArray(source.predators, predatorLength, transferables),
        predatorCount: source.predatorCount,
        food: snapshotTypedArray(source.food, foodLength, transferables),
        foodCount: source.foodCount,
        sharedBuffer: source.sharedBuffer,
    };

    return { buffers, transferables };
}
