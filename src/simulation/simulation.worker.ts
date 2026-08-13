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
import type { WorkerCommand, WorkerResponse } from './WorkerMessages';
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
    command: (simulationEngine: SimulationEngine) => Promise<unknown>,
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
}

function stopAutoUpdate(): void {
    isRunning = false;
    if (timeoutId !== null) {
        self.clearTimeout(timeoutId);
        timeoutId = null;
    }
}

function handleSyncCamera(command: Extract<WorkerCommand, { type: 'syncCamera' }>): void {
    if (!engine) return;
    engine.setCameraData({
        position: command.position,
        target: command.target,
        zoom: command.zoom,
        distance: command.distance,
        fov: command.fov,
        aspect: command.aspect,
        near: 0.1,
        far: 1000,
    });
}

function handleGeneticRoots(): void {
    if (!engine) return;
    sendResponse({
        type: 'commandResponse',
        requestId: 'geneticRoots',
        result: engine.getGeneticRoots(),
    });
}

function handleExportState(requestId: string): void {
    if (!engine) return;
    sendResponse({
        type: 'commandResponse',
        requestId,
        result: engine.exportState(),
    });
}

function handleImportState(command: Extract<WorkerCommand, { type: 'importState' }>): void {
    if (!engine) return;
    engine.importState(command.state);
    sendResponse({ type: 'stats', stats: engine.getStats() });
}

function handleLifecycleCommand(command: WorkerCommand): boolean {
    switch (command.type) {
        case 'init': handleInit(command.scale); return true;
        case 'update':
            if (!isRunning) handleUpdate();
            return true;
        case 'reset': handleReset(); return true;
        case 'setConfig': handleSetConfig(command.config); return true;
        case 'getStats': handleGetStats(); return true;
        default: return false;
    }
}

function handleQueryCommand(command: WorkerCommand): boolean {
    switch (command.type) {
        case 'findEntityAt':
            void handleAsyncCommand(e => e.findEntityAt(command.position, command.tolerance), command.requestId);
            return true;
        case 'getEntityByInstanceId':
            void handleAsyncCommand(e => e.getEntityByInstanceId(command.entityType, command.instanceId, command.isDead), command.requestId);
            return true;
        case 'getGeneticNode':
            void handleAsyncCommand(e => e.getGeneticNode(command.genomeId), command.requestId);
            return true;
        case 'getGeneticRoots': handleGeneticRoots(); return true;
        case 'exportState': handleExportState(command.requestId); return true;
        case 'importState': handleImportState(command); return true;
        default: return false;
    }
}

function handleControlCommand(command: WorkerCommand): void {
    switch (command.type) {
        case 'syncCamera': handleSyncCamera(command); break;
        case 'startLoop': startAutoUpdate(); break;
        case 'stopLoop': stopAutoUpdate(); break;
        case 'setSpeed': speedFactor = command.speed; break;
        default:
            sendResponse({ type: 'error', message: `Unknown command: ${JSON.stringify(command)}` });
    }
}

self.onmessage = (event: MessageEvent<unknown>): void => {
    const data = event.data;
    if (!isWorkerCommand(data)) return;
    if (handleLifecycleCommand(data)) return;
    if (handleQueryCommand(data)) return;
    handleControlCommand(data);
};

sendResponse({ type: 'ready' });
