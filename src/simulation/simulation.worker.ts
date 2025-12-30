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
let timeoutId: any = null;

let lastTime = performance.now();
let accumulator = 0;
let speedFactor = 1.0;
const TIMESTEP = 1000 / 60; // 60 TPS фізики (фіксований крок)

// ============================================================================
// ОБРОБКА ПОВІДОМЛЕНЬ
// ============================================================================

/**
 * Надсилання відповіді до main thread.
 */
function sendResponse(response: WorkerResponse): void {
    // Якщо відповідь містить буфери, передаємо їх як transferable
    // УВАГА: Transferable робить буфер непридатним для використання у відправника (detached)
    // Оскільки BufferManager наразі використовує звичайні Float32Array і намагається їх перевикористовувати,
    // ми НЕ передаємо їх як transferable, щоб уникнути детачменту, 
    // ЯКЩО це не SharedArrayBuffer.
    if (response.type === 'updated' && response.buffers) {
        if (response.buffers.sharedBuffer) {
            // SharedArrayBuffer не потребує transferables для спільного використання,
            // він просто копіює посилання, але дані спільні.
            self.postMessage(response);
        } else {
            // Для звичайних буферів копіювання (без transferables) безпечніше, 
            // поки ми не перейдемо на повний SAB або не зміними логіку BufferManager
            self.postMessage(response);
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
 * Виконання одного тіку симуляції.
 */
function handleUpdate(): void {
    if (!engine) return;

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
 * Отримання статистики.
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
 * Оновлення конфігурації.
 */
function handleSetConfig(config: Partial<SimulationEngine['config']>): void {
    if (!engine) return;
    Object.assign(engine.config, config);
    // Notify about updated stats
    sendResponse({ type: 'stats', stats: engine.getStats() });
}

/**
 * Автоматичний цикл оновлення (Fixed Time Step + Accumulator).
 */
function loop(): void {
    if (!isRunning || !engine) return;

    const now = performance.now();
    const dt = (now - lastTime) * speedFactor;
    lastTime = now;
    accumulator += dt;

    let updated = false;
    // Захист від "спіралі смерті" (max 10 кроків за раз)
    let safetyCounter = 0;
    while (accumulator >= TIMESTEP && safetyCounter < 10) {
        engine.update();
        accumulator -= TIMESTEP;
        updated = true;
        safetyCounter++;
    }

    if (updated) {
        const buffers = engine.getRenderData();
        const stats = engine.getStats();
        const tick = engine.getTick();

        sendResponse({
            type: 'updated',
            buffers,
            stats,
            tick,
        });
    }

    timeoutId = self.setTimeout(loop, 1000 / 60);
}

function startAutoUpdate(): void {
    if (isRunning && timeoutId !== null) return;
    isRunning = true;

    if (engine && timeoutId === null) {
        logger.info('Worker: Starting simulation loop', 'SimulationWorker');
        lastTime = performance.now();
        accumulator = 0;
        engine.start();
        loop();
    } else if (!engine) {
        logger.info('Worker: Loop requested but engine not ready. it will start automatically after init.', 'SimulationWorker');
    }
}

function stopAutoUpdate(): void {
    isRunning = false;
    if (timeoutId !== null) {
        self.clearTimeout(timeoutId);
        timeoutId = null;
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerCommand>): void => {
    const data = event.data;

    if (!isWorkerCommand(data)) {
        sendResponse({ type: 'error', message: 'Invalid command format' });
        return;
    }

    switch (data.type) {
        case 'init': handleInit(data.scale); break;
        case 'update': handleUpdate(); break;
        case 'reset': handleReset(); break;
        case 'getStats': handleGetStats(); break;
        case 'setConfig': handleSetConfig(data.config); break;
        case 'pause':
        case 'stopLoop': stopAutoUpdate(); break;
        case 'resume':
        case 'startLoop': startAutoUpdate(); break;
        case 'setSpeed':
            speedFactor = data.speed;
            logger.debug(`Worker: Speed updated to ${speedFactor}`, 'SimulationWorker');
            break;
        case 'findEntityAt':
            handleAsyncCommand(e => e.findEntityAt(data.position, data.tolerance), data.requestId);
            break;
        case 'getEntityByInstanceId':
            handleAsyncCommand(e => e.getEntityByInstanceId(data.entityType, data.instanceId, data.isDead), data.requestId);
            break;
        case 'getGeneticNode':
            handleAsyncCommand(e => e.getGeneticNode(data.genomeId as import('@/types').GenomeId), data.requestId);
            break;
        case 'getGeneticRoots':
            handleAsyncCommand(e => e.getGeneticRoots(), data.requestId);
            break;
        default:
            sendResponse({ type: 'error', message: `Unknown command: ${(data as any).type}` });
    }
};

// Сигналізуємо про готовність воркера
sendResponse({ type: 'ready' });
