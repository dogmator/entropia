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
    reject: (reason?: unknown) => void;
}

interface CameraPayload {
    position: Vector3;
    target: Vector3;
}

const DEFAULT_TICK_RATE = 60;
const ASYNC_COMMAND_TIMEOUT_MS = 5000;
const CONFIG_BATCH_DEBOUNCE_MS = 32;
const PERFORMANCE_HISTORY_LIMIT = 600;

const FALLBACK_SIMULATION_CONFIG: SimulationConfig = {
    foodSpawnRate: 0,
    maxFood: 0,
    maxOrganisms: 0,
    showObstacles: true,
    mutationFactor: 0,
    reproductionThreshold: 0,
    organismOpacity: 1,
    foodOpacity: 1,
    organismScale: 1,
    foodScale: 1,
    bloomIntensity: 0,
    showGrid: false,
    gridOpacity: 0,
    trailLength: 0,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    graphicsQuality: 'CUSTOM',
    drag: 1,
    separationWeight: 0,
    alignmentWeight: 0,
    cohesionWeight: 0,
    seekWeight: 0,
    avoidWeight: 0,
};

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
    private lastLoopCommand: 'startLoop' | 'stopLoop' | null = null;
    private lastSpeed: number | null = null;
    private pendingConfigPatch: Partial<SimulationConfig> = {};
    private configBatchTimer: ReturnType<typeof setTimeout> | null = null;
    private lastExportedState: SerializedSimulationStateV1 | null = null;
    private latestCameraPayload: CameraPayload | null = null;

    constructor(options: EngineProxyOptions = {}) {
        this.tickRate = options.tickRate ?? DEFAULT_TICK_RATE;
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
        const payload: CameraPayload = { position: _position, target: _target };
        if (
            this.latestCameraPayload &&
            this.isCameraPayloadEqual(this.latestCameraPayload, payload)
        ) {
            return;
        }

        this.latestCameraPayload = payload;
    }

    public getStatsWithWorldData(): SimulationStats {
        return this.getStats();
    }

    public reset(): void {
        this.flushPendingConfigBatch();
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
        this.flushPendingConfigBatch();

        this.requestExportStateSnapshot();

        return this.lastExportedState ?? this.buildFallbackExportState();
    }

    public importState(state: SerializedSimulationStateV1): void {
        this.flushPendingConfigBatch();

        this.sendAsyncCommand<boolean>('importState', { state })
            .then(() => {
                logger.info('Proxy: importState applied', 'EngineProxy', { tick: state.tick });
            })
            .catch((error: unknown) => {
                logger.error('Proxy: importState command failed', 'EngineProxy', { error });
            });
    }

    public updateConfig(newConfig: Partial<SimulationConfig>): void {
        if (this._config) {
            Object.assign(this._config, newConfig);
        }

        this.pendingConfigPatch = {
            ...this.pendingConfigPatch,
            ...newConfig,
        };

        if (this.configBatchTimer !== null) {
            clearTimeout(this.configBatchTimer);
        }

        this.configBatchTimer = setTimeout(() => {
            const patch = this.pendingConfigPatch;
            this.pendingConfigPatch = {};
            this.configBatchTimer = null;

            if (Object.keys(patch).length === 0) {
                return;
            }

            this.sendCommand({ type: 'setConfig', config: patch });
            logger.info('Proxy: Sent batched setConfig command', 'EngineProxy', { config: patch });
        }, CONFIG_BATCH_DEBOUNCE_MS);
    }

    public updateWorldScale(scale: number): void {
        this.flushPendingConfigBatch();
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
        if (this.configBatchTimer) {
            clearTimeout(this.configBatchTimer);
            this.configBatchTimer = null;
        }
        this.pendingConfigPatch = {};
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

        if (command.type !== 'setConfig') {
            this.flushPendingConfigBatch();
        }

        if (command.type === 'setSpeed') {
            if (this.lastSpeed === command.speed) {
                return;
            }
            this.lastSpeed = command.speed;
        }

        if (command.type === 'startLoop' || command.type === 'stopLoop') {
            if (this.lastLoopCommand === command.type) {
                return;
            }
            this.lastLoopCommand = command.type;
        }

        // Don't log high-frequency updates to avoid spam, unless debugging specific issue
        if (command.type !== 'update') {
            logger.info(`Proxy: Sending command ${command.type}`, 'EngineProxy', { command });
        }
        this.worker.postMessage(command);
    }

    private sendAsyncCommand<T>(type: string, payload: Record<string, unknown>): Promise<T> {
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
            }, ASYNC_COMMAND_TIMEOUT_MS);
        });
    }

    private isCameraPayloadEqual(a: CameraPayload, b: CameraPayload): boolean {
        return (
            a.position.x === b.position.x &&
            a.position.y === b.position.y &&
            a.position.z === b.position.z &&
            a.target.x === b.target.x &&
            a.target.y === b.target.y &&
            a.target.z === b.target.z
        );
    }

    private buildFallbackExportState(): SerializedSimulationStateV1 {
        return {
            version: 1,
            seed: 0,
            rngState: 0,
            tick: 0,
            counters: {
                foodIdCounter: 0,
                obstacleIdCounter: 0,
                organismIdCounter: 0,
                genomeIdCounter: 0,
            },
            stats: {
                totalDeaths: 0,
                totalBirths: 0,
                maxAge: 0,
                maxGeneration: 0,
            },
            config: this._config ?? FALLBACK_SIMULATION_CONFIG,
            zones: [],
            obstacles: [],
            food: [],
            organisms: [],
            geneticTree: {
                roots: [],
                nodes: [],
            },
        };
    }

    private requestExportStateSnapshot(): void {
        this.sendAsyncCommand<SerializedSimulationStateV1>('exportState', {})
            .then((state) => {
                this.lastExportedState = state;
            })
            .catch((error: unknown) => {
                logger.error('Proxy: exportState command failed', 'EngineProxy', { error });
            });
    }

    private flushPendingConfigBatch(): void {
        if (!this.worker) {
            this.pendingConfigPatch = {};
            if (this.configBatchTimer !== null) {
                clearTimeout(this.configBatchTimer);
                this.configBatchTimer = null;
            }
            return;
        }

        if (this.configBatchTimer !== null) {
            clearTimeout(this.configBatchTimer);
            this.configBatchTimer = null;
        }

        if (Object.keys(this.pendingConfigPatch).length === 0) {
            return;
        }

        const patch = this.pendingConfigPatch;
        this.pendingConfigPatch = {};
        this.worker.postMessage({ type: 'setConfig', config: patch });
        logger.info('Proxy: Flushed batched setConfig command before critical command', 'EngineProxy', { config: patch });
    }

    private handleMessage(event: MessageEvent): void {
        const response = event.data;

        if (!isWorkerResponse(response)) {
            console.warn('Unknown worker message:', response);
            return;
        }

        this.updatePerformanceHistory(response);

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

    private updatePerformanceHistory(response: WorkerResponse): void {
        if (!('stats' in response) || !response.stats || !response.stats.performance) {
            return;
        }

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
        if (this._performanceHistory.length > PERFORMANCE_HISTORY_LIMIT) {
            this._performanceHistory.shift();
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
