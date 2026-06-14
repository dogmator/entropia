import { logger } from '@/core';
import type { EcologicalZone, GenomeId, RenderBuffers, SerializedSimulationStateV1, SimulationConfig, SimulationEvent, SimulationStats, Vector3, WorldConfig } from '@/types';

import type { IEntity } from '../interfaces/IEntity';
import type { IEntityInfo, IPerformanceMonitor, ISimulationEngine } from '../interfaces/ISimulationEngine';
import type { InitializedResponse, WorkerResponse } from '../WorkerMessages';
import { ConfigBatcher } from './ConfigBatcher.service';
import { buildFallbackExportState } from './EngineProxy.utils';
import { WorkerChannel } from './WorkerChannel.service';

export interface EngineProxyOptions { scale?: number; tickRate?: number; }
interface CameraPayload { position: Vector3; target: Vector3; }
const DEFAULT_TICK_RATE = 60;

export class EngineProxy implements ISimulationEngine {
    private worker: Worker | null = null;
    private isInitialized = false;
    private readonly tickRate: number;
    private lastStats: SimulationStats | null = null;
    private lastBuffers: RenderBuffers | null = null;
    private _worldConfig: WorldConfig | null = null;
    private _zones = new Map<string, EcologicalZone>();
    private _obstacles = new Map<string, IEntity>();
    private _config: SimulationConfig | null = null;
    private readonly configBatcher: ConfigBatcher;
    private readonly channel: WorkerChannel;
    private lastExportedState: SerializedSimulationStateV1 | null = null;
    private latestCameraPayload: CameraPayload | null = null;

    constructor(options: EngineProxyOptions = {}) {
        this.tickRate = options.tickRate ?? DEFAULT_TICK_RATE;
        this.configBatcher = new ConfigBatcher(() => this.worker);
        this.channel = new WorkerChannel(() => this.worker, {
            onStateUpdate: (data) => { this.handleInitialized(data); },
            onBuffersUpdate: (buffers) => { this.lastBuffers = buffers; },
            onStatsUpdate: (stats) => { this.lastStats = stats; },
            onError: (m) => { logger.error(`Simulation Error: ${m}`, 'EngineProxy'); },
            tickRate: this.tickRate
        });
    }

    public get config(): SimulationConfig {
        if (!this._config) throw new Error('EngineProxy not initialized');
        return this._config;
    }
    public get worldConfig(): WorldConfig {
        if (!this._worldConfig) throw new Error('EngineProxy not initialized');
        return this._worldConfig;
    }
    public get zones(): Map<string, EcologicalZone> { return this._zones; }
    public get obstacles(): Map<string, IEntity> { return this._obstacles; }
    public update(): void { this.channel.sendCommand({ type: 'update' }, () => { this.configBatcher.flush(); }); }
    public getRenderData(): RenderBuffers {
        return this.lastBuffers ?? { prey: new Float32Array(0), predators: new Float32Array(0), food: new Float32Array(0), preyCount: 0, predatorCount: 0, foodCount: 0 };
    }
    public getStats(): SimulationStats {
        return this.lastStats ?? { preyCount: 0, predatorCount: 0, foodCount: 0, avgEnergy: 0, avgPreyEnergy: 0, avgPredatorEnergy: 0, generation: 0, maxGeneration: 0, maxAge: 0, totalDeaths: 0, totalBirths: 0, extinctionRisk: 0 };
    }
    public setCameraData(p: Vector3, t: Vector3): void {
        const payload: CameraPayload = { position: p, target: t };
        if (this.latestCameraPayload && this.isCameraPayloadEqual(this.latestCameraPayload, payload)) return;
        this.latestCameraPayload = payload;
    }
    public getStatsWithWorldData(): SimulationStats { return this.getStats(); }
    public reset(): void {
        this.configBatcher.flush();
        this.channel.sendCommand({ type: 'reset' }, () => { this.configBatcher.flush(); });
        this.channel.sendCommand({ type: 'update' }, () => { this.configBatcher.flush(); });
    }
    public getPerformanceMonitor(): IPerformanceMonitor {
        return { getMemoryStats: () => ({ usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0, used: 0, total: 0, limit: 0 }), getPerformanceHistory: () => this.channel.performanceHistory };
    }
    public async findEntityAt(p: Vector3, d: number): Promise<IEntityInfo | null> { return this.channel.sendAsyncCommand('findEntityAt', { position: p, tolerance: d }); }
    public async getEntityByInstanceId(t: string, i: number, d = false): Promise<IEntityInfo | null> {
        if (t !== 'prey' && t !== 'predator' && t !== 'food') return null;
        return this.channel.sendAsyncCommand('getEntityByInstanceId', { entityType: t, instanceId: i, isDead: d });
    }
    public async getGeneticNode(id: GenomeId): Promise<unknown> { return this.channel.sendAsyncCommand('getGeneticNode', { genomeId: id }); }
    public async getGeneticRoots(): Promise<GenomeId[]> { return this.channel.sendAsyncCommand('getGeneticRoots', {}); }
    public exportState(): SerializedSimulationStateV1 {
        this.configBatcher.flush();
        this.channel.sendAsyncCommand<SerializedSimulationStateV1>('exportState', {})
            .then(s => { this.lastExportedState = s; })
            .catch((e: unknown) => { logger.error('Proxy: exportState failed', 'EngineProxy', { error: e }); });
        return this.lastExportedState ?? buildFallbackExportState(this._config ?? undefined);
    }
    public importState(s: SerializedSimulationStateV1): void {
        this.configBatcher.flush();
        this.channel.sendAsyncCommand<boolean>('importState', { state: s })
            .then(() => { logger.info('Proxy: importState applied', 'EngineProxy', { tick: s.tick }); })
            .catch((e: unknown) => { logger.error('Proxy: importState failed', 'EngineProxy', { error: e }); });
    }
    public updateConfig(c: Partial<SimulationConfig>): void { this.configBatcher.updateConfig(c, this._config ?? undefined); }
    public updateWorldScale(s: number): void {
        this.configBatcher.flush();
        logger.info(`Proxy: Updating world scale to ${String(s)}`, 'EngineProxy');
        this.channel.sendCommand({ type: 'init', scale: s }, () => { this.configBatcher.flush(); });
    }
    public addEventListener(c: (event: SimulationEvent) => void): () => void { return this.channel.addEventListener(c); }
    public async init(scale = 1.0): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker(new URL('../simulation.worker.ts', import.meta.url), { type: 'module' });
                const bootHandler = (event: MessageEvent) => {
                    const r = event.data as WorkerResponse;
                    if (r.type === 'ready') this.worker?.postMessage({ type: 'init', scale });
                    else if (r.type === 'initialized') { this.handleInitialized(r); resolve(); }
                    else if (r.type === 'error') { logger.error(`Proxy: Init error: ${r.message}`, 'EngineProxy'); reject(new Error(r.message)); }
                };
                this.worker.onmessage = (e) => { if (!this.isInitialized) bootHandler(e); else this.channel.dispatch(e); };
                this.worker.onerror = (e) => { logger.error(`Worker error: ${e.message}`, 'EngineProxy'); reject(new Error(e.message)); };
            } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
        });
    }
    public dispose(): void { this.pause(); this.worker?.terminate(); this.worker = null; this.isInitialized = false; this.configBatcher.dispose(); this.channel.dispose(); }
    public destroy(): void { this.dispose(); }
    private handleInitialized(r: InitializedResponse): void {
        this.isInitialized = true; this.lastStats = r.stats; this._worldConfig = r.worldConfig; this._zones = r.zones; this._obstacles = r.obstacles; this._config = r.config;
        logger.info('Proxy: Worker initialized', 'EngineProxy');
    }
    private isCameraPayloadEqual(a: CameraPayload, b: CameraPayload): boolean {
        return a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z && a.target.x === b.target.x && a.target.y === b.target.y && a.target.z === b.target.z;
    }
    public pause(): void { this.channel.sendCommand({ type: 'stopLoop' }, () => { this.configBatcher.flush(); }); }
    public resume(): void { this.channel.sendCommand({ type: 'startLoop' }, () => { this.configBatcher.flush(); }); }
    public setSpeed(s: number): void { this.channel.sendCommand({ type: 'setSpeed', speed: s }, () => { this.configBatcher.flush(); }); }
}
