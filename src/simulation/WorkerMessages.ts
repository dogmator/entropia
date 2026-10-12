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

export interface ImportStateCommand {
    readonly type: 'importState';
    readonly state: SerializedSimulationStateV1;
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
    readonly stack?: string;
}

export interface ReadyResponse {
    readonly type: 'ready';
}

export interface CommandResponse {
    readonly type: 'commandResponse';
    readonly requestId: string;
    readonly result: unknown;
}

export type WorkerResponse =
    | InitializedResponse
    | UpdatedResponse
    | StatsResponse
    | ErrorResponse
    | ReadyResponse
    | CommandResponse;

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
