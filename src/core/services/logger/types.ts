/**
 * Entropia 3D — Base types and enums for the logging system.
 */

export enum LogLevel {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    source?: string;
    data?: Record<string, unknown>;
}

export interface LoggerStats {
    total: number;
    info: number;
    warning: number;
    error: number;
    recent: number;
}
