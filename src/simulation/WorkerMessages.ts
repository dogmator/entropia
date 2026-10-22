/**
 * Entropia 3D — Type-safe message protocol for Web Worker.
 *
 * Defines:
 * - WorkerCommand — messages from main thread to worker
 * - WorkerResponse — messages from worker to main thread
 */

import type {
    EcologicalZone,
    GenomeId,
    RenderBuffers,
    SerializedSimulationStateV1,
    SimulationConfig,
    SimulationStats,
    Vector3,
    WorldConfig,
} from '@/types';

import type { IEntity } from './interfaces/IEntity';

// ============================================================================
// COMMANDS (Main Thread → Worker)
// ============================================================================

export interface InitCommand {
    readonly type: 'init';
    readonly scale: number;
}

export interface UpdateCommand {
    readonly type: 'update';
}

export interface ResetCommand {
    readonly type: 'reset';
}

export interface SetConfigCommand {
    readonly type: 'setConfig';
    readonly config: Partial<SimulationConfig>;
}

export interface GetStatsCommand {
    readonly type: 'getStats';
}

export interface FindEntityAtCommand {
    readonly type: 'findEntityAt';
    readonly requestId: string;
    readonly position: Vector3;
    readonly tolerance: number;
}

export interface GetEntityByInstanceIdCommand {
    readonly type: 'getEntityByInstanceId';
    readonly requestId: string;
    readonly entityType: 'prey' | 'predator' | 'food';
    readonly instanceId: number;
    readonly isDead?: boolean;
}

export interface GetGeneticNodeCommand {
    readonly type: 'getGeneticNode';
    readonly requestId: string;
    readonly genomeId: GenomeId;
}

export interface SyncCameraCommand {
    readonly type: 'syncCamera';
    readonly position: Vector3;
    readonly target: Vector3;
    readonly zoom: number;
    readonly distance: number;
    readonly fov: number;
    readonly aspect: number;
}

export interface GetGeneticRootsCommand {
    readonly type: 'getGeneticRoots';
}

export interface ExportStateCommand {
    readonly type: 'exportState';
    readonly requestId: string;
}

/**
 * First half of an import: builds the restored world without touching the live one. The token names the import until it
 * is committed or cancelled.
 */
export interface ImportStateCommand {
    readonly type: 'importState';
    readonly requestId: string;
    readonly importToken: string;
    readonly state: SerializedSimulationStateV1;
}

/**
 * Second half of an import: swaps in the world prepared under the same token. The settings changed while the import was in
 * flight come with it, so the restored world has them before its first tick.
 */
export interface CommitImportCommand {
    readonly type: 'commitImport';
    readonly requestId: string;
    readonly importToken: string;
    readonly updates?: Partial<SimulationConfig>;
}

/** Drops the world prepared under a token, when its import gave up before the commit. Needs no answer. */
export interface CancelImportCommand {
    readonly type: 'cancelImport';
    readonly importToken: string;
}

/**
 * Asks whether the commit of one import replaced the live world. The worker answers commands in the order it received
 * them, so the answer comes after any commit sent before this probe.
 */
export interface ProbeImportCommand {
    readonly type: 'probeImport';
    readonly requestId: string;
    readonly importToken: string;
}

export interface StartLoopCommand {
    readonly type: 'startLoop';
}

export interface StopLoopCommand {
    readonly type: 'stopLoop';
}

export interface SetSpeedCommand {
    readonly type: 'setSpeed';
    readonly speed: number;
}

export type WorkerCommand =
    | InitCommand
    | UpdateCommand
    | ResetCommand
    | SetConfigCommand
    | GetStatsCommand
    | FindEntityAtCommand
    | GetEntityByInstanceIdCommand
    | GetGeneticNodeCommand
    | SyncCameraCommand
    | GetGeneticRootsCommand
    | ExportStateCommand
    | ImportStateCommand
    | CommitImportCommand
    | CancelImportCommand
    | ProbeImportCommand
    | StartLoopCommand
    | StopLoopCommand
    | SetSpeedCommand;

// ============================================================================
// RESPONSES (Worker → Main Thread)
// ============================================================================

export interface InitializedResponse {
    readonly type: 'initialized';
    readonly stats: SimulationStats;
    readonly config: SimulationConfig;
    readonly worldConfig: WorldConfig;
    readonly zones: Map<string, EcologicalZone>;
    readonly obstacles: Map<string, IEntity>;
}

export interface UpdatedResponse {
    readonly type: 'updated';
    readonly buffers: RenderBuffers;
    readonly stats: SimulationStats;
    readonly tick: number;
}

export interface StatsResponse {
    readonly type: 'stats';
    readonly stats: SimulationStats;
}

export interface ErrorResponse {
    readonly type: 'error';
    readonly message: string;
    readonly stack?: string | undefined;
}

export interface ReadyResponse {
    readonly type: 'ready';
}

export interface CommandResponse {
    readonly type: 'commandResponse';
    readonly requestId: string;
    readonly result: unknown;
}

/** Answers one request that failed. The message is the actual reason, so the caller can report it. */
export interface CommandErrorResponse {
    readonly type: 'commandError';
    readonly requestId: string;
    readonly message: string;
    readonly stack?: string | undefined;
}

/** Acknowledgement of an applied snapshot: the state the live engine now reports, so the caller can refresh its copies. */
export interface SnapshotImportResult {
    readonly tick: number;
    readonly stats: SimulationStats;
    readonly config: SimulationConfig;
    readonly worldConfig: WorldConfig;
    readonly zones: Map<string, EcologicalZone>;
    readonly obstacles: Map<string, IEntity>;
}

/** The worker's record of one import, with the live world as it is now, so the proxy can refresh its copies from it. */
export interface ImportProbeResult {
    readonly committed: boolean;
    readonly live: SnapshotImportResult;
}

export type WorkerResponse =
    | InitializedResponse
    | UpdatedResponse
    | StatsResponse
    | ErrorResponse
    | ReadyResponse
    | CommandResponse
    | CommandErrorResponse;

// ============================================================================
// WORKER CONSOLE FORWARDING (Worker → Main Thread)
// ============================================================================

export type WorkerConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * Console output captured inside the worker and forwarded to the main thread
 * so it can be logged (and shipped to the remote sink). Kept separate from
 * WorkerResponse so existing worker response types stay unchanged.
 */
export interface WorkerConsoleMessage {
    readonly type: 'worker-console';
    readonly level: WorkerConsoleLevel;
    readonly args: readonly string[];
    readonly timestamp: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Type guard to check command type.
 */
export function isWorkerCommand(msg: unknown): msg is WorkerCommand {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        typeof (msg as WorkerCommand).type === 'string'
    );
}

/**
 * Type guard to check response type.
 */
export function isWorkerResponse(msg: unknown): msg is WorkerResponse {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        typeof (msg as WorkerResponse).type === 'string'
    );
}

/**
 * Type guard for forwarded worker console messages.
 */
export function isWorkerConsoleMessage(msg: unknown): msg is WorkerConsoleMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type?: unknown }).type === 'worker-console'
    );
}
