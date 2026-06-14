/**
 * Entropia 3D — Simulation Web Worker.
 *
 * This file executes in a separate thread (worker thread).
 * Hosts SimulationEngine and processes commands from the main thread.
 */

import { logger } from '@/core';

import { SimulationEngine } from './engine/Engine';
import {
    DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
    shouldDispatchRenderSnapshot
} from './workerCadence';
import type { WorkerResponse } from './WorkerMessages';
import { isWorkerCommand } from './WorkerMessages';
import { snapshotRenderBuffers } from './workerSnapshot';

// ============================================================================
// WORKER STATE
// ============================================================================

let engine: SimulationEngine | null = null;
let isRunning = false;
let timeoutId: number | null = null;

let lastTime = performance.now();
let lastSnapshotTime = 0;
let accumulator = 0;
let speedFactor = 1.0;
const MILLISECONDS_PER_SECOND = 1000;
const WORKER_LOOP_FPS = 60;
const MAX_UPDATES_PER_LOOP = 10;
const TIMESTEP = MILLISECONDS_PER_SECOND / WORKER_LOOP_FPS;

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/**
 * Sending response to main thread.
 */
function sendResponse(response: WorkerResponse, transferables: Transferable[] = []): void {
    if (transferables.length > 0) {
        self.postMessage(response, transferables);
        return;
    }

    self.postMessage(response);
}

/**
 * Processing initialization command.
 */
function handleInit(scale: number): void {
    try {
        engine = new SimulationEngine(scale);
        const stats = engine.getStats();
        const config = engine.config;
        const worldConfig = engine.worldConfig;

        sendResponse({
            type: 'initialized',
            stats,
            config,
            worldConfig,
            zones: engine.getZones(),
            obstacles: engine.obstacles,
        });

        if (isRunning) {
            logger.info('Worker: Engine initialized, starting deferred loop', 'SimulationWorker');
            startAutoUpdate();
        }
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to initialize engine',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

/**
 * Executing one simulation tick.
 */
function handleUpdate(): void {
    if (!engine) return;

    try {
        engine.update();
        const { buffers, transferables } = snapshotRenderBuffers(engine.getRenderData());
        const stats = engine.getStats();
        const tick = engine.getTick();

        sendResponse({
            type: 'updated',
            buffers,
            stats,
            tick,
        }, transferables);
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Update failed',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

/**
 * Resetting simulation.
 */
function handleReset(): void {
    if (!engine) return;

    try {
        engine.reset();
        sendResponse({ type: 'stats', stats: engine.getStats() });
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Reset failed',
        });
    }
}

/**
 * Getting statistics.
 */
function handleGetStats(): void {
    if (!engine) return;
    sendResponse({ type: 'stats', stats: engine.getStats() });
}

/**
 * Generic handler for async commands.
 */
async function handleAsyncCommand(
    command: (engine: SimulationEngine) => Promise<unknown>,
    requestId: string
): Promise<void> {
    if (!engine) {
        sendResponse({ type: 'commandResponse', requestId, result: null });
        return;
    }

    try {
        const result = await command(engine);
        sendResponse({ type: 'commandResponse', requestId, result });
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Command failed',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

/**
 * Updating configuration.
 */
function handleSetConfig(config: Partial<SimulationEngine['config']>): void {
    if (!engine) return;
    Object.assign(engine.config, config);
    // Notify about updated stats
    sendResponse({ type: 'stats', stats: engine.getStats() });
}

/**
 * Automatic update loop (Fixed Time Step + Accumulator).
 */
function loop(): void {
    if (!isRunning || !engine) return;

    const now = performance.now();
    const dt = (now - lastTime) * speedFactor;
    lastTime = now;
    accumulator += dt;

    let isUpdated = false;
    // Protection against "death spiral" (max 10 steps at once)
    let safetyCounter = 0;
    while (accumulator >= TIMESTEP && safetyCounter < MAX_UPDATES_PER_LOOP) {
        engine.update();
        accumulator -= TIMESTEP;
        isUpdated = true;
        safetyCounter++;
    }

    if (isUpdated) {
        const shouldSendSnapshot = shouldDispatchRenderSnapshot({
            updated: isUpdated,
            now,
            lastSnapshotTime,
            minIntervalMs: DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
        });

        if (shouldSendSnapshot) {
            const { buffers, transferables } = snapshotRenderBuffers(engine.getRenderData());
            const stats = engine.getStats();
            const tick = engine.getTick();

            sendResponse({
                type: 'updated',
                buffers,
                stats,
                tick,
            }, transferables);
            lastSnapshotTime = now;
        }
    }

    timeoutId = self.setTimeout(loop, MILLISECONDS_PER_SECOND / WORKER_LOOP_FPS);
}

function startAutoUpdate(): void {
    if (isRunning && timeoutId !== null) return;
    isRunning = true;

    if (engine && timeoutId === null) {
        lastTime = performance.now();
        lastSnapshotTime = lastTime - DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS;
        accumulator = 0;
        engine.start();
        loop();
    }
    // else: engine not ready yet — loop will start automatically in handleInit
}

function stopAutoUpdate(): void {
    isRunning = false;
    if (timeoutId !== null) {
        self.clearTimeout(timeoutId);
        timeoutId = null;
    }
}

/**
 * Main command handler.
 */
self.onmessage = (event: MessageEvent): void => {
    const data = event.data;

    if (!isWorkerCommand(data)) {
        return;
    }

    switch (data.type) {
        case 'init':
            handleInit(data.scale);
            break;
        case 'update':
            // Manual update if auto-loop is off
            if (!isRunning) handleUpdate();
            break;
        case 'reset':
            handleReset();
            break;
        case 'setConfig':
            handleSetConfig(data.config);
            break;
        case 'getStats':
            handleGetStats();
            break;
        case 'findEntityAt':
            void handleAsyncCommand(e => e.findEntityAt(data.position, data.tolerance), data.requestId);
            break;
        case 'getEntityByInstanceId':
            void handleAsyncCommand(e => e.getEntityByInstanceId(data.entityType, data.instanceId, data.isDead), data.requestId);
            break;
        case 'getGeneticNode':
            void handleAsyncCommand(e => e.getGeneticNode(data.genomeId as import('@/types').GenomeId), data.requestId);
            break;
        case 'syncCamera':
            if (engine) {
                engine.setCameraData({
                    position: data.position,
                    target: data.target,
                    zoom: data.zoom,
                    distance: data.distance,
                    fov: data.fov,
                    aspect: data.aspect,
                    near: 0.1,
                    far: 1000,
                });
            }
            break;
        case 'getGeneticRoots':
            if (engine) {
                sendResponse({
                    type: 'commandResponse',
                    requestId: 'geneticRoots',
                    result: engine.getGeneticRoots(),
                });
            }
            break;
        case 'exportState':
            if (engine) {
                sendResponse({
                    type: 'commandResponse',
                    requestId: data.requestId,
                    result: engine.exportState(),
                });
            }
            break;
        case 'importState':
            if (engine) {
                engine.importState(data.state as any);
                sendResponse({ type: 'stats', stats: engine.getStats() });
            }
            break;
        case 'startLoop':
            startAutoUpdate();
            break;
        case 'stopLoop':
            stopAutoUpdate();
            break;
        case 'setSpeed':
            speedFactor = data.speed;
            break;
        case 'asyncCommand':
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            void handleAsyncCommand((engine) => (engine as any)[data.commandName](data.payload), data.requestId);
            break;
        default:
            sendResponse({ type: 'error', message: `Unknown command: ${JSON.stringify(data)}` });
    }
};

// Signal worker readiness
sendResponse({ type: 'ready' });
