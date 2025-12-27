/**
 * Entropia 3D — Типобезпечний протокол повідомлень для Web Worker.
 *
 * Визначає:
 * - WorkerCommand — повідомлення від main thread до worker
 * - WorkerResponse — повідомлення від worker до main thread
 */

import type { RenderBuffers, SimulationConfig, SimulationStats, WorldConfig } from '@/types';

// ============================================================================
// КОМАНДИ (Main Thread → Worker)
// ============================================================================

export interface InitCommand {
    readonly type: 'init';
    readonly scale: number;
    readonly config?: Partial<SimulationConfig>;
}

export interface UpdateCommand {
    readonly type: 'update';
}

export interface ResetCommand {
    readonly type: 'reset';
}

export interface GetStatsCommand {
    readonly type: 'getStats';
}

export interface SetConfigCommand {
    readonly type: 'setConfig';
    readonly config: Partial<SimulationConfig>;
}

export interface PauseCommand {
    readonly type: 'pause';
}

export interface ResumeCommand {
    readonly type: 'resume';
}

export type WorkerCommand =
    | InitCommand
    | UpdateCommand
    | ResetCommand
    | GetStatsCommand
    | SetConfigCommand
    | PauseCommand
    | ResumeCommand;

// ============================================================================
// ВІДПОВІДІ (Worker → Main Thread)
// ============================================================================

export interface InitializedResponse {
    readonly type: 'initialized';
    readonly stats: SimulationStats;
    readonly worldConfig: WorldConfig;
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

export type WorkerResponse =
    | InitializedResponse
    | UpdatedResponse
    | StatsResponse
    | ErrorResponse
    | ReadyResponse;

// ============================================================================
// УТИЛІТИ
// ============================================================================

/**
 * Type guard для перевірки типу команди.
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
 * Type guard для перевірки типу відповіді.
 */
export function isWorkerResponse(msg: unknown): msg is WorkerResponse {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        typeof (msg as WorkerResponse).type === 'string'
    );
}
