/**
 * Entropia 3D — Engine Proxy для комунікації з Web Worker.
 *
 * Надає той самий API, що й SimulationEngine (ISimulationEngine),
 * але делегує виконання до воркера через postMessage.
 */

import { logger } from '@/core';
import type { Obstacle } from '@/simulation';
import type {
    EcologicalZone,
    GenomeId,
    RenderBuffers,
    SerializedSimulationStateV1,
    SimulationConfig,
    SimulationEvent,
    SimulationStats,
    SystemMetrics,
    Vector3,
    WorldConfig
} from '@/types';

import type { IEntityInfo, IPerformanceMonitor, ISimulationEngine } from './interfaces/ISimulationEngine';
import type {
    CommandResponse,
    UpdatedResponse,
    WorkerCommand,
    WorkerResponse
} from './WorkerMessages';
import { isWorkerResponse } from './WorkerMessages';

// ============================================================================
// ТИПИ
// ============================================================================

export interface EngineProxyOptions {
    scale?: number;
    tickRate?: number;
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason?: any) => void;
}

// ============================================================================
// ENGINE PROXY
// ============================================================================

/**
 * Proxy клас для керування SimulationEngine в Web Worker.
 */
export class EngineProxy implements ISimulationEngine {
    private worker: Worker | null = null;
    private isInitialized = false;
    private tickRate: number;

    private lastStats: SimulationStats | null = null;
    private lastBuffers: RenderBuffers | null = null;
    private _worldConfig: WorldConfig | null = null;
    private _zones: Map<string, EcologicalZone> = new Map();
    private _obstacles: Map<string, Obstacle> = new Map();
    private _config: SimulationConfig | null = null;
    private _performanceHistory: SystemMetrics[] = [];

    // Обробка подій
    private listeners: Set<(event: SimulationEvent) => void> = new Set();

    // Кореляція запитів
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private requestCounter = 0;

    constructor(options: EngineProxyOptions = {}) {
        this.tickRate = options.tickRate ?? 60;
    }

    // ============================================================================
    // РЕАЛІЗАЦІЯ ISimulationEngine
    // ============================================================================

    public get config(): SimulationConfig {
        if (!this._config) {
            throw new Error('EngineProxy not initialized: config not available');
        }
        return this._config;
    }

    public get worldConfig(): WorldConfig {
        if (!this._worldConfig) {
            throw new Error('EngineProxy not initialized: worldConfig not available');
        }
        return this._worldConfig;
    }

    public get zones(): Map<string, EcologicalZone> {
        return this._zones;
    }

    public get obstacles(): Map<string, Obstacle> {
        return this._obstacles;
    }

    public update(): void {
        // Now handled internally by worker loop.
        // Can be used for manual single-step if needed in future.
        this.sendCommand({ type: 'update' });
    }

    public getRenderData(): RenderBuffers {
        if (!this.lastBuffers) {
            // Повертаємо пусті буфери якщо ще немає даних, щоб не крашити рендер
            return {
                prey: new Float32Array(0),
                predators: new Float32Array(0),
                food: new Float32Array(0),
                preyCount: 0,
                predatorCount: 0,
                foodCount: 0
            };
        }
        return this.lastBuffers;
    }

    public getStats(): SimulationStats {
        return this.lastStats || {
            preyCount: 0,
            predatorCount: 0,
            foodCount: 0,
            avgEnergy: 0,
            avgPreyEnergy: 0,
            avgPredatorEnergy: 0,
            generation: 0,
            maxGeneration: 0,
            maxAge: 0,
            totalDeaths: 0,
            totalBirths: 0,
            extinctionRisk: 0
        };
    }

    public setCameraData(_position: Vector3, _target: Vector3): void {
        // TODO: Можна оптимізувати і не слати кожен кадр, якщо воркеру це не критично.
        // Але ISimulationEngine вимагає цього методу.
        // Поки що заглушка, або реалізація відправки даних, якщо воркеру це треба для логіки (наприклад LOD).
        // В оригіналі Engine використовує це для StatisticsManager для метрик.
        // this._position = position;
        // this._target = target;
    }

    public getStatsWithWorldData(): SimulationStats {
        return this.getStats();
    }

    public reset(): void {
        this.sendCommand({ type: 'reset' });
        // Очищаємо локальний стан, хоча воркер скоро пришле оновлення
        // this._position = position;
        // this._target = target;
    }

    public getPerformanceMonitor(): IPerformanceMonitor {
        return {
            getMemoryStats: () => ({
                usedJSHeapSize: 0,
                totalJSHeapSize: 0,
                jsHeapSizeLimit: 0,
                used: 0,
                total: 0,
                limit: 0
            }),
            getPerformanceHistory: () => this._performanceHistory
        };
    }

    public async findEntityAt(worldPosition: Vector3, maxDistance: number): Promise<IEntityInfo | null> {
        return this.sendAsyncCommand<IEntityInfo | null>('findEntityAt', {
            position: worldPosition,
            tolerance: maxDistance
        });
    }

    public async getEntityByInstanceId(entityType: string, instanceId: number, isDead: boolean = false): Promise<IEntityInfo | null> {
        if (entityType !== 'prey' && entityType !== 'predator' && entityType !== 'food') {
            return null;
        }
        return this.sendAsyncCommand<IEntityInfo | null>('getEntityByInstanceId', {
            entityType,
            instanceId,
            isDead
        });
    }

    public async getGeneticNode(genomeId: GenomeId): Promise<unknown> {
        return this.sendAsyncCommand<unknown>('getGeneticNode', { genomeId });
    }

    public async getGeneticRoots(): Promise<GenomeId[]> {
        return this.sendAsyncCommand<GenomeId[]>('getGeneticRoots', {});
    }

    public exportState(): SerializedSimulationStateV1 {
        throw new Error('exportState not implemented in EngineProxy yet');
    }

    public importState(_state: SerializedSimulationStateV1): void {
        throw new Error('importState not implemented in EngineProxy yet');
    }

    public updateConfig(newConfig: Partial<SimulationConfig>): void {
        if (this._config) {
            Object.assign(this._config, newConfig);
        }
        this.sendCommand({ type: 'setConfig', config: newConfig });
        logger.info('Proxy: Sent setConfig command', 'EngineProxy', { config: newConfig });
    }

    public updateWorldScale(scale: number): void {
        logger.info(`Proxy: Updating world scale to ${scale} (re-init)`, 'EngineProxy');
        this.sendCommand({ type: 'init', scale });
    }



    public addEventListener(callback: (event: SimulationEvent) => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    // ============================================================================
    // УПРАВЛІННЯ ЖИТТЄВИМ ЦИКЛОМ
    // ============================================================================

    public async init(scale: number = 1.0): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker(
                    new URL('./simulation.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = this.handleMessage.bind(this);
                this.worker.onerror = (error) => {
                    console.error('Worker error:', error);
                    this.emitError(error.message);
                    reject(error);
                };

                // Чекаємо на ready
                // Тимчасовий handler для boot-стадії
                const bootHandler = (event: MessageEvent) => {
                    const response = event.data as WorkerResponse;
                    if (response.type === 'ready') {
                        // Відправляємо init команду
                        this.worker?.postMessage({ type: 'init', scale });
                    } else if (response.type === 'initialized') {
                        this.isInitialized = true;
                        this.lastStats = response.stats;
                        this._worldConfig = response.worldConfig;
                        this._zones = response.zones;
                        this._obstacles = response.obstacles;
                        this._config = response.config;

                        // Знімаємо цей handler і переходимо до основного
                        logger.info('Proxy: Worker initialized', 'EngineProxy');
                        resolve();
                    } else if (response.type === 'error') {
                        logger.error(`Proxy: Worker initialization error: ${response.message}`, 'EngineProxy');
                        reject(new Error(response.message));
                    }
                };

                // Перехоплюємо повідомлення для init
                const originalHandler = this.handleMessage.bind(this);
                this.worker.onmessage = (event) => {
                    if (!this.isInitialized) {
                        bootHandler(event);
                    } else {
                        originalHandler(event);
                    }
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    public dispose(): void {
        this.pause();
        this.worker?.terminate();
        this.worker = null;
        this.isInitialized = false;
        this.pendingRequests.clear();
        this.listeners.clear();
    }

    public destroy(): void {
        this.dispose();
    }

    // ============================================================================
    // ПРИВАТНІ МЕТОДИ
    // ============================================================================

    private sendCommand(command: WorkerCommand): void {
        if (!this.worker) return;
        // Don't log high-frequency updates to avoid spam, unless debugging specific issue
        if (command.type !== 'update') {
            logger.info(`Proxy: Sending command ${command.type}`, 'EngineProxy', { command });
        }
        this.worker.postMessage(command);
    }

    private sendAsyncCommand<T>(type: string, payload: any): Promise<T> {
        if (!this.worker) {
            return Promise.reject(new Error('Worker not initialized'));
        }

        const requestId = `${type}_${++this.requestCounter}`;
        console.debug(`[Proxy] Sending async command: ${type} (req: ${requestId})`);

        return new Promise<T>((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve: resolve as (v: unknown) => void, reject });

            this.worker!.postMessage({
                type,
                requestId,
                ...payload
            });

            // Захист по таймауту?
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Timeout for command ${type}`));
                }
            }, 5000);
        });
    }

    private handleMessage(event: MessageEvent): void {
        const response = event.data;

        if (!isWorkerResponse(response)) {
            console.warn('Unknown worker message:', response);
            return;
        }

        if ('stats' in response && response.stats && response.stats.performance) {
            // Конвертація PerformanceMetrics у формат SystemMetrics (або мапінг)
            // SystemMetrics: cpu, memory, fps, tps, timestamp ...
            // stats.performance: fps, tps, frameTime ...
            // Перевірка сумісності типів або їх підмножин.
            // Спрощений мапінг:
            const pm = response.stats.performance;
            const metrics: SystemMetrics = {
                cpu: 0,
                memory: 0,
                fps: pm.fps,
                tps: pm.tps,
                timestamp: performance.now(),
                frameTime: pm.frameTime,
                simulationTime: pm.simulationTime,
                entityCount: pm.entityCount,
                memoryUsage: 0,
                drawCalls: pm.drawCalls
            };
            this._performanceHistory.push(metrics);
            if (this._performanceHistory.length > 600) {
                this._performanceHistory.shift();
            }
        }

        switch (response.type) {
            case 'updated':
                this.handleUpdated(response);
                break;

            case 'stats':
                this.lastStats = response.stats;
                break;

            case 'error':
                this.emitError(response.message);
                break;

            case 'initialized':
                this.isInitialized = true;
                this.lastStats = response.stats;
                this._worldConfig = response.worldConfig;
                this._zones = response.zones;
                this._obstacles = response.obstacles;
                this._config = response.config;
                // Notify listeners if necessary, or just rely on next update
                logger.info('Proxy: Re-initialized from worker', 'EngineProxy');
                break;

            case 'commandResponse':
                this.handleCommandResponse(response);
                break;
        }
    }

    private handleUpdated(response: UpdatedResponse): void {
        const { buffers, stats, tick } = response;
        this.lastBuffers = buffers;
        this.lastStats = stats;

        // Синтезуємо подію TickUpdated для UI
        const event: SimulationEvent = {
            type: 'TickUpdated',
            tick,
            stats,
            deltaTime: 1 / this.tickRate // Approximate
        };

        this.emitEvent(event);
    }

    private handleCommandResponse(response: CommandResponse): void {
        const { requestId, result } = response;
        console.debug(`[Proxy] Received response for req: ${requestId}`);
        const request = this.pendingRequests.get(requestId);
        if (request) {
            request.resolve(result);
            this.pendingRequests.delete(requestId);
        }
    }

    private emitEvent(event: SimulationEvent): void {
        this.listeners.forEach(listener => tryCall(listener, event));
    }

    private emitError(message: string): void {
        // Можна зробити окрему подію Error, якщо інтерфейс підтримує
        // Або логувати
        console.error('Simulation Error:', message);
    }

    // Методи управління циклом
    public pause() { this.sendCommand({ type: 'stopLoop' }); }
    public resume() { this.sendCommand({ type: 'startLoop' }); }
    public setSpeed(speed: number) { this.sendCommand({ type: 'setSpeed', speed }); }
}

function tryCall<T>(fn: (arg: T) => void, arg: T) {
    try {
        fn(arg);
    } catch (e) {
        console.error('Error in event listener:', e);
    }
}
