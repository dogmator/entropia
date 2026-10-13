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
import type { WorkerCommand, WorkerConsoleLevel, WorkerConsoleMessage, WorkerResponse } from './WorkerMessages';
import { isWorkerCommand } from './WorkerMessages';
import { snapshotRenderBuffers } from './workerSnapshot';

// ============================================================================
// LOG TRANSPORT (Worker → Main Thread)
// ============================================================================

/**
 * Serializes a log argument into a string safe to postMessage.
 */
const serializeLogArg = (arg: unknown): string => {
    if (arg instanceof Error) {
        return arg.stack ?? `${arg.name}: ${arg.message}`;
    }
    if (typeof arg === 'string') {
        return arg;
    }
    if (arg === null || typeof arg !== 'object') {
        return String(arg);
    }
    try {
        return JSON.stringify(arg);
    } catch {
        return '[Unserializable]';
    }
};

/**
 * Explicit transport to the main thread. Relies only on `self.postMessage`
 * (never on `console.*`), so Terser's `drop_console` cannot strip it in
 * production builds.
 */
const postLog = (level: WorkerConsoleLevel, args: readonly unknown[]): void => {
    try {
        const payload: WorkerConsoleMessage = {
            type: 'worker-console',
            level,
            args: args.map(serializeLogArg),
            timestamp: Date.now(),
        };
        self.postMessage(payload);
    } catch {
        // Never let log forwarding break worker execution.
    }
};

// Keep the native console for worker DevTools, and forward direct console.* calls.
const nativeConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
};

console.log = (...args: unknown[]): void => { nativeConsole.log(...args); postLog('log', args); };
console.info = (...args: unknown[]): void => { nativeConsole.info(...args); postLog('info', args); };
console.warn = (...args: unknown[]): void => { nativeConsole.warn(...args); postLog('warn', args); };
console.error = (...args: unknown[]): void => { nativeConsole.error(...args); postLog('error', args); };
console.debug = (...args: unknown[]): void => { nativeConsole.debug(...args); postLog('debug', args); };

// Route the shared logger's warning/error output through postLog as well. Set
// after construction, so it does not depend on import order and does not use the
// native console the logger bound at construction time.
logger.setOutputSink((message, level, data) => {
    const workerLevel: WorkerConsoleLevel = String(level) === 'error' ? 'error' : 'warn';
    postLog(workerLevel, data === undefined ? [message] : [message, data]);
});

// Dev-only hook so the smoke test can exercise the logger → main path.
if (import.meta.env.DEV) {
    (globalThis as unknown as { __entropiaSmoke?: { warnViaLogger: (msg: string) => void } }).__entropiaSmoke = {
        warnViaLogger: (msg: string): void => { logger.warn(msg, 'Smoke'); },
    };
}

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
 * Builds a structured, postMessage-safe error payload for logger calls.
 */
const describeError = (error: unknown): Record<string, unknown> => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
});

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
        logger.error('worker init failed', 'Worker:Init', describeError(error));
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
        logger.error('worker update failed', 'Worker:Update', describeError(error));
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

    logger.info('worker reset', 'Worker:Reset');

    try {
        engine.reset();
        sendResponse({ type: 'stats', stats: engine.getStats() });
    } catch (error) {
        logger.error('worker reset failed', 'Worker:Reset', describeError(error));
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
        logger.error('worker async command failed', 'Worker:AsyncCommand', describeError(error));
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
    logger.info('worker config updated', 'Worker:Config', { keys: Object.keys(config) });
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
    logger.debug('worker received message', 'Worker:Message', { type: data.type });
    if (handleLifecycleCommand(data)) return;
    if (handleQueryCommand(data)) return;
    handleControlCommand(data);
};

sendResponse({ type: 'ready' });
