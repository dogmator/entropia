/**
 * Entropia 3D — Engine Proxy для комунікації з Web Worker.
 *
 * Надає той самий API, що й SimulationEngine, але делегує виконання
 * до воркера через postMessage.
 */

import type { RenderBuffers, SimulationConfig, SimulationStats, WorldConfig } from '@/types';

import type {
    InitializedResponse,
    UpdatedResponse,
    WorkerCommand,
    WorkerResponse,
} from './WorkerMessages';
import { isWorkerResponse } from './WorkerMessages';

// ============================================================================
// ТИПИ
// ============================================================================

export interface EngineProxyCallbacks {
    onUpdate?: (buffers: RenderBuffers, stats: SimulationStats, tick: number) => void;
    onError?: (message: string) => void;
    onReady?: () => void;
    onInitialized?: (stats: SimulationStats, worldConfig: WorldConfig) => void;
}

export interface EngineProxyOptions {
    scale?: number;
    autoStart?: boolean;
    tickRate?: number;
}

// ============================================================================
// ENGINE PROXY
// ============================================================================

/**
 * Proxy клас для керування SimulationEngine в Web Worker.
 */
export class EngineProxy {
    private worker: Worker | null = null;
    private callbacks: EngineProxyCallbacks = {};
    private isInitialized = false;
    private isPaused = true;
    private tickIntervalId: number | null = null;
    private readonly tickRate: number;

    private lastStats: SimulationStats | null = null;
    private lastBuffers: RenderBuffers | null = null;
    private worldConfig: WorldConfig | null = null;

    constructor(options: EngineProxyOptions = {}) {
        this.tickRate = options.tickRate ?? 60;
    }

    /**
     * Ініціалізація воркера та симуляції.
     */
    public async init(scale: number = 1.0): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Створюємо воркер через Vite worker import
                this.worker = new Worker(
                    new URL('./simulation.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = this.handleMessage.bind(this);
                this.worker.onerror = (error) => {
                    this.callbacks.onError?.(error.message);
                    reject(error);
                };

                // Чекаємо на ready, потім ініціалізуємо
                const onReady = (response: WorkerResponse): void => {
                    if (response.type === 'ready') {
                        this.sendCommand({ type: 'init', scale });
                    } else if (response.type === 'initialized') {
                        this.isInitialized = true;
                        this.lastStats = response.stats;
                        this.worldConfig = response.worldConfig;
                        this.callbacks.onInitialized?.(response.stats, response.worldConfig);
                        resolve();
                    } else if (response.type === 'error') {
                        reject(new Error(response.message));
                    }
                };

                // Тимчасовий handler для ініціалізації
                const originalHandler = this.handleMessage.bind(this);
                this.worker.onmessage = (event: MessageEvent) => {
                    const response = event.data as WorkerResponse;
                    if (!this.isInitialized) {
                        onReady(response);
                    } else {
                        originalHandler(event);
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Запуск автоматичного циклу оновлення.
     */
    public start(): void {
        if (!this.isInitialized || !this.isPaused) { return; }

        this.isPaused = false;
        const intervalMs = Math.floor(1000 / this.tickRate);

        this.tickIntervalId = window.setInterval(() => {
            if (!this.isPaused) {
                this.sendCommand({ type: 'update' });
            }
        }, intervalMs);
    }

    /**
     * Зупинка симуляції.
     */
    public pause(): void {
        this.isPaused = true;
        if (this.tickIntervalId !== null) {
            window.clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
    }

    /**
     * Скидання симуляції.
     */
    public reset(): void {
        this.sendCommand({ type: 'reset' });
    }

    /**
     * Оновлення конфігурації.
     */
    public setConfig(config: Partial<SimulationConfig>): void {
        this.sendCommand({ type: 'setConfig', config });
    }

    /**
     * Отримання статистики.
     */
    public getStats(): SimulationStats | null {
        return this.lastStats;
    }

    /**
     * Отримання останніх буферів.
     */
    public getRenderData(): RenderBuffers | null {
        return this.lastBuffers;
    }

    /**
     * Отримання конфігурації світу.
     */
    public getWorldConfig(): WorldConfig | null {
        return this.worldConfig;
    }

    /**
     * Перевірка стану.
     */
    public get running(): boolean {
        return !this.isPaused && this.isInitialized;
    }

    /**
     * Встановлення callbacks.
     */
    public on<K extends keyof EngineProxyCallbacks>(
        event: K,
        callback: EngineProxyCallbacks[K]
    ): void {
        this.callbacks[event] = callback;
    }

    /**
     * Знищення воркера.
     */
    public dispose(): void {
        this.pause();
        this.worker?.terminate();
        this.worker = null;
        this.isInitialized = false;
    }

    // ============================================================================
    // ПРИВАТНІ МЕТОДИ
    // ============================================================================

    private sendCommand(command: WorkerCommand): void {
        if (!this.worker) {
            this.callbacks.onError?.('Worker not initialized');
            return;
        }
        this.worker.postMessage(command);
    }

    private handleMessage(event: MessageEvent): void {
        const response = event.data;

        if (!isWorkerResponse(response)) {
            this.callbacks.onError?.('Invalid response from worker');
            return;
        }

        switch (response.type) {
            case 'updated':
                this.handleUpdated(response);
                break;

            case 'stats':
                this.lastStats = response.stats;
                break;

            case 'error':
                this.callbacks.onError?.(response.message);
                break;

            case 'ready':
                this.callbacks.onReady?.();
                break;

            case 'initialized':
                this.handleInitialized(response);
                break;
        }
    }

    private handleUpdated(response: UpdatedResponse): void {
        const { buffers, stats, tick } = response;

        // Зберігаємо SharedArrayBuffer, якщо він прийшов вперше (або оновився)
        // Якщо буфери не прийшли, але ми маємо кешований SAB, ми можемо використовувати його.
        // Проте зараз BufferManager завжди присилає TypedArrays, навіть якщо SAB той самий.
        // У майбутньому ми можемо оптимізувати це ще більше.

        this.lastBuffers = buffers;
        this.lastStats = stats;
        this.callbacks.onUpdate?.(buffers, stats, tick);
    }

    private handleInitialized(response: InitializedResponse): void {
        this.isInitialized = true;
        this.lastStats = response.stats;
        this.worldConfig = response.worldConfig;
        this.callbacks.onInitialized?.(response.stats, response.worldConfig);
    }
}
