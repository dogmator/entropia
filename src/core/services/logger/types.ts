/**
 * Entropia 3D — Базові типи та перерахування системи логування.
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
