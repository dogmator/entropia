import { logger } from '@/core';
import type { RenderBuffers, SimulationEvent, SimulationStats, SystemMetrics } from '@/types';

import { type CommandResponse, type ErrorResponse, type InitializedResponse, isWorkerResponse, type StatsResponse, type UpdatedResponse, type WorkerCommand, type WorkerResponse } from '../WorkerMessages';

const ASYNC_COMMAND_TIMEOUT_MS = 5000;
const PERFORMANCE_HISTORY_LIMIT = 600;

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface ChannelCallbacks {
    onStateUpdate: (data: InitializedResponse) => void;
    onBuffersUpdate: (buffers: RenderBuffers) => void;
    onStatsUpdate: (stats: SimulationStats) => void;
    onError: (message: string) => void;
    tickRate: number;
}

/**
 * Service for communication with the simulation Web Worker.
 */
export class WorkerChannel {
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private requestCounter = 0;
    private readonly listeners = new Set<(event: SimulationEvent) => void>();
    private readonly _performanceHistory: SystemMetrics[] = [];
    private lastLoopCommand: 'startLoop' | 'stopLoop' | null = null;
    private lastSpeed: number | null = null;

    private readonly handlers: Record<WorkerResponse['type'], (r: WorkerResponse) => void> = {
        updated: (r) => { this.handleUpdated(r as UpdatedResponse); },
        stats: (r) => { this.callbacks.onStatsUpdate((r as StatsResponse).stats); },
        error: (r) => {
            const message = (r as ErrorResponse).message;
            this.callbacks.onError(message);
            logger.error(`Simulation Error: ${message}`, 'WorkerChannel');
        },
        initialized: (r) => { this.callbacks.onStateUpdate(r as InitializedResponse); },
        commandResponse: (r) => { this.handleCommandResponse(r as CommandResponse); },
        ready: () => { /* Handled during boot */ },
    };

    constructor(private readonly getWorker: () => Worker | null, private readonly callbacks: ChannelCallbacks) {}

    public sendCommand(command: WorkerCommand, flushConfig: () => void): void {
        const worker = this.getWorker();
        if (!worker) return;
        if (command.type !== 'setConfig') flushConfig();
        if (command.type === 'setSpeed') {
            if (this.lastSpeed === command.speed) return;
            this.lastSpeed = command.speed;
        }
        if (command.type === 'startLoop' || command.type === 'stopLoop') {
            if (this.lastLoopCommand === command.type) return;
            this.lastLoopCommand = command.type;
        }
        if (command.type !== 'update') logger.info(`Proxy: Sending command ${command.type}`, 'WorkerChannel', { command });
        worker.postMessage(command);
    }

    public async sendAsyncCommand<T>(type: string, payload: Record<string, unknown>): Promise<T> {
        const worker = this.getWorker();
        if (!worker) return Promise.reject(new Error('Worker not initialized'));
        const requestId = `${type}_${String(++this.requestCounter)}`;
        logger.debug(`[Proxy] Sending async command: ${type} (req: ${requestId})`, 'WorkerChannel');
        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                const request = this.pendingRequests.get(requestId);
                if (!request) return;
                this.pendingRequests.delete(requestId);
                reject(new Error(`Timeout for command ${type}`));
            }, ASYNC_COMMAND_TIMEOUT_MS);
            this.pendingRequests.set(requestId, { resolve: resolve as (v: unknown) => void, reject, timeoutId });
            worker.postMessage({ type, requestId, ...payload });
        });
    }

    public dispatch(event: MessageEvent): void {
        const response = event.data as unknown;
        if (!isWorkerResponse(response)) {
            logger.warn('Unknown worker message:', 'WorkerChannel', { response });
            return;
        }
        this.updatePerformanceHistory(response);
        this.handlers[response.type](response);
    }

    private updatePerformanceHistory(response: WorkerResponse): void {
        if (!('stats' in response) || !response.stats.performance) return;
        const pm = response.stats.performance;
        const metrics: SystemMetrics = {
            cpu: 0, memory: 0, fps: pm.fps, tps: pm.tps, timestamp: performance.now(),
            frameTime: pm.frameTime, simulationTime: pm.simulationTime, entityCount: pm.entityCount,
            memoryUsage: 0, drawCalls: pm.drawCalls
        };
        this._performanceHistory.push(metrics);
        if (this._performanceHistory.length > PERFORMANCE_HISTORY_LIMIT) this._performanceHistory.shift();
    }

    private handleUpdated(response: UpdatedResponse): void {
        const { buffers, stats, tick } = response;
        this.callbacks.onBuffersUpdate(buffers);
        this.callbacks.onStatsUpdate(stats);
        this.emitEvent({ type: 'TickUpdated', tick, stats, deltaTime: 1 / this.callbacks.tickRate });
    }

    private handleCommandResponse(response: CommandResponse): void {
        const { requestId, result } = response;
        logger.debug(`[Proxy] Received response for req: ${requestId}`, 'WorkerChannel');
        const request = this.pendingRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeoutId);
            request.resolve(result);
            this.pendingRequests.delete(requestId);
        }
    }

    public addEventListener(callback: (event: SimulationEvent) => void): () => void {
        this.listeners.add(callback);
        return () => { this.listeners.delete(callback); };
    }

    private emitEvent(event: SimulationEvent): void {
        this.listeners.forEach(listener => {
            try { listener(event); } catch (e) { logger.error('Error in event listener:', 'WorkerChannel', { error: e }); }
        });
    }

    public get performanceHistory(): SystemMetrics[] { return this._performanceHistory; }

    public dispose(): void {
        this.pendingRequests.forEach(r => { clearTimeout(r.timeoutId); });
        this.pendingRequests.clear();
        this.listeners.clear();
    }
}
