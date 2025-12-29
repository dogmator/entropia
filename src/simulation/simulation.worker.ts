/**
 * Entropia 3D — Web Worker для симуляції.
 *
 * Цей файл виконується в окремому потоці (worker thread).
 * Hosts SimulationEngine і обробляє команди від main thread.
 */

import { logger } from '@/core';

import { SimulationEngine } from './Engine';
import type { WorkerCommand, WorkerResponse } from './WorkerMessages';
import { isWorkerCommand } from './WorkerMessages';

// ============================================================================
// СТАН ВОРКЕРА
// ============================================================================

let engine: SimulationEngine | null = null;
let isRunning = false;
let animationFrameId: number | null = null;

// ============================================================================
// ОБРОБКА ПОВІДОМЛЕНЬ
// ============================================================================

/**
 * Надсилання відповіді до main thread.
 */
function sendResponse(response: WorkerResponse): void {
    // Якщо відповідь містить буфери, передаємо їх як transferable
    if (response.type === 'updated' && response.buffers) {
        // Якщо використовується SharedArrayBuffer, нам не потрібно передавати буфери щоразу
        if (response.buffers.sharedBuffer) {
            self.postMessage(response);
        } else {
            const transferables: Transferable[] = [
                response.buffers.prey.buffer,
                response.buffers.predators.buffer,
                response.buffers.food.buffer,
            ];
            self.postMessage(response, transferables);
        }
    } else {
        self.postMessage(response);
    }
}

/**
 * Обробка команди ініціалізації.
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
            engine.start();
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
 * Виконання одного тіку симуляції.
 */
function handleUpdate(): void {
    if (!engine) {
        sendResponse({
            type: 'error',
            message: 'Engine not initialized',
        });
        return;
    }

    try {
        engine.update();
        const buffers = engine.getRenderData();
        const stats = engine.getStats();
        const tick = engine.getTick();

        sendResponse({
            type: 'updated',
            buffers,
            stats,
            tick,
        });
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Update failed',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

/**
 * Скидання симуляції.
 */
function handleReset(): void {
    if (!engine) {
        sendResponse({
            type: 'error',
            message: 'Engine not initialized',
        });
        return;
    }

    try {
        engine.reset();
        const stats = engine.getStats();

        sendResponse({
            type: 'stats',
            stats,
        });
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Reset failed',
        });
    }
}

/**
 * Отримання статистики.
 */
function handleGetStats(): void {
    if (!engine) {
        sendResponse({
            type: 'error',
            message: 'Engine not initialized',
        });
        return;
    }

    sendResponse({
        type: 'stats',
        stats: engine.getStats(),
    });
}

/**
 * Generic handler for async commands.
 */
async function handleAsyncCommand(
    command: (engine: SimulationEngine) => Promise<unknown>,
    requestId: string
): Promise<void> {
    if (!engine) {
        sendResponse({
            type: 'commandResponse', // Fix: respond with commandResponse even on error for correlation? Or error?
            requestId,
            result: null, // Returning null/undefined as result on engine missing
        });
        return;
    }

    try {
        const result = await command(engine);
        sendResponse({
            type: 'commandResponse',
            requestId,
            result,
        });
    } catch (error) {
        sendResponse({
            type: 'error',
            message: error instanceof Error ? error.message : 'Command failed',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}

/**
 * Оновлення конфігурації.
 */
function handleSetConfig(config: Partial<SimulationEngine['config']>): void {
    if (!engine) {
        sendResponse({
            type: 'error',
            message: 'Engine not initialized',
        });
        return;
    }

    Object.assign(engine.config, config);

    sendResponse({
        type: 'stats',
        stats: engine.getStats(),
    });
}

/**
 * Автоматичний цикл оновлення.
 */
function startAutoUpdate(): void {
    if (isRunning) { return; }
    isRunning = true;

    engine?.start(); // Ensure engine is in RUNNING state

    const tick = (): void => {
        if (!isRunning || !engine) { return; }

        handleUpdate();
        animationFrameId = self.requestAnimationFrame(tick);
    };

    animationFrameId = self.requestAnimationFrame(tick);
}

function stopAutoUpdate(): void {
    isRunning = false;
    if (animationFrameId !== null) {
        self.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = (event: MessageEvent): void => {
    const data = event.data;

    if (!isWorkerCommand(data)) {
        sendResponse({
            type: 'error',
            message: 'Invalid command format',
        });
        return;
    }

    switch (data.type) {
        case 'init':
            logger.info(`Worker: Received init command (scale: ${data.scale})`, 'SimulationWorker');
            handleInit(data.scale);
            break;

        case 'update':
            handleUpdate();
            break;

        case 'reset':
            handleReset();
            break;

        case 'getStats':
            handleGetStats();
            break;

        case 'setConfig':
            handleSetConfig(data.config);
            break;

        case 'pause':
            stopAutoUpdate();
            break;

        case 'resume':
            startAutoUpdate();
            break;

        case 'findEntityAt':
            logger.info(`Worker: Processing findEntityAt (req: ${data.requestId})`, 'SimulationWorker');
            handleAsyncCommand(e => e.findEntityAt(data.position, data.tolerance), data.requestId);
            break;

        case 'getEntityByInstanceId':
            logger.info(`Worker: Processing getEntityByInstanceId (req: ${data.requestId})`, 'SimulationWorker');
            handleAsyncCommand(e => e.getEntityByInstanceId(data.entityType, data.instanceId, data.isDead), data.requestId);
            break;

        case 'getGeneticNode':
            handleAsyncCommand(e => e.getGeneticNode(data.genomeId as import('@/types').GenomeId), data.requestId);
            break;

        case 'getGeneticRoots':
            handleAsyncCommand(e => e.getGeneticRoots(), data.requestId);
            break;

        default:
            sendResponse({
                type: 'error',
                message: `Unknown command: ${(data as WorkerCommand).type}`,
            });
    }
};

// Сигналізуємо про готовність воркера
sendResponse({ type: 'ready' });
