import { DEBUG_CONFIG } from '@/config';

import { WebSocketTransport } from './transports/WebSocketTransport';
import type { LogEntry, LoggerStats} from './types';
import { LogLevel } from './types';

interface LogPayload {
    level: LogLevel;
    message: string;
    source?: string;
    data?: Record<string, unknown>;
}

interface InternalStats {
    info: number;
    warning: number;
    error: number;
}

const LOGGER_MAX_LOGS = 1000;
const LOGGER_RECENT_MINUTES_DEFAULT = 10;
const LOGGER_RECENT_MINUTES_STATS = 5;
const LOGGER_PERFORMANCE_THRESHOLD = 100;
const LOGGER_CLEANUP_PERCENTAGE = 0.1;
const LOGGER_PERFORMANCE_PRECISION_DIGITS = 2;
const MILLISECONDS_PER_MINUTE = 60_000;
const PERFORMANCE_SOURCE = 'Performance';
const SYSTEM_SOURCE = 'System';
const SIMULATION_SOURCE = 'Simulation';

const cloneStats = (stats: InternalStats): InternalStats => ({ ...stats });


const safeStringify = (value: unknown): string => {
    const seen = new WeakSet();

    return JSON.stringify(value, (_key, currentValue: unknown) => {
        if (typeof currentValue !== 'object' || currentValue === null) {
            return currentValue;
        }

        if (seen.has(currentValue)) {
            return '[Circular]';
        }

        seen.add(currentValue);
        return currentValue;
    });
};

const normalizeMinutes = (minutes: number): number =>
    Number.isFinite(minutes) && minutes > 0 ? minutes : LOGGER_RECENT_MINUTES_DEFAULT;

const isSamePayload = (entry: LogEntry, payload: LogPayload): boolean =>
    entry.level === payload.level &&
    entry.message === payload.message &&
    entry.source === payload.source &&
    safeStringify(entry.data) === safeStringify(payload.data);

/**
 * Logger — Centralized logging system for Entropia 3D.
 * Supports local storage of logs for UI and remote transmission through transports.
 */
export class Logger {
    private static instance: Logger | undefined;
    private logs: LogEntry[] = [];
    private readonly subscribers = new Set<(logs: LogEntry[]) => void>();
    private readonly transport: WebSocketTransport;
    private maxLogs: number = LOGGER_MAX_LOGS;
    private stats: InternalStats = { info: 0, warning: 0, error: 0 };

    private constructor() {
        this.transport = new WebSocketTransport();
        this.transport.setEnabled(DEBUG_CONFIG.remoteLoggingEnabled);
    }

    public static getInstance(): Logger {
        Logger.instance ??= new Logger();
        return Logger.instance;
    }

    public setRemoteLogging(enabled: boolean): void {
        this.transport.setEnabled(enabled && this.isDevelopment());
    }

    public setMaxLogs(maxLogs: number): void {
        this.maxLogs = Math.max(1, Math.floor(maxLogs));
        this.cleanupOldLogs();
    }

    public info(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog({ level: LogLevel.INFO, message, source, data });
    }

    public warning(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog({ level: LogLevel.WARNING, message, source, data });
    }

    public error(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog({ level: LogLevel.ERROR, message, source, data });
    }

    private addLog(payload: LogPayload): void {
        if (this.isDuplicateLog(payload)) {
            return;
        }

        const entry = this.createLogEntry(payload);
        this.logs.push(entry);
        this.incrementStats(entry.level);
        this.cleanupOldLogs();
        this.notifySubscribers();
        this.outputToConsole(entry);
        this.transport.send(entry);
    }

    private isDuplicateLog(payload: LogPayload): boolean {
        const lastLog = this.logs.at(-1);
        if (!lastLog) {
            return false;
        }

        return isSamePayload(lastLog, payload);
    }

    private createLogEntry(payload: LogPayload): LogEntry {
        return {
            timestamp: Date.now(),
            level: payload.level,
            message: payload.message,
            source: payload.source,
            data: payload.data
        };
    }

    private incrementStats(level: LogLevel): void {
        if (level === LogLevel.INFO) {
            this.stats.info += 1;
            return;
        }

        if (level === LogLevel.WARNING) {
            this.stats.warning += 1;
            return;
        }

        this.stats.error += 1;
    }

    private cleanupOldLogs(): void {
        if (this.logs.length <= this.maxLogs) {
            return;
        }

        const removeCount = Math.max(1, Math.floor(this.maxLogs * LOGGER_CLEANUP_PERCENTAGE));
        const removed = this.logs.splice(0, removeCount);
        this.recalculateStatsAfterRemoval(removed);
    }

    private recalculateStatsAfterRemoval(removedEntries: LogEntry[]): void {
        if (removedEntries.length === 0) {
            return;
        }

        const nextStats = cloneStats(this.stats);
        removedEntries.forEach((entry) => {
            if (entry.level === LogLevel.INFO) {
                nextStats.info = Math.max(0, nextStats.info - 1);
            } else if (entry.level === LogLevel.WARNING) {
                nextStats.warning = Math.max(0, nextStats.warning - 1);
            } else {
                nextStats.error = Math.max(0, nextStats.error - 1);
            }
        });

        this.stats = nextStats;
    }

    private outputToConsole(entry: LogEntry): void {
        if (entry.level !== LogLevel.ERROR && entry.level !== LogLevel.WARNING) {
            return;
        }

        const sourcePrefix = entry.source ? ` [${entry.source}]` : '';
        const message = `[${entry.level.toUpperCase()}]${sourcePrefix}: ${entry.message}`;
        const consoleMethod = entry.level === LogLevel.ERROR ? console.error : console.warn;

        if (entry.data) {
            consoleMethod(message, entry.data);
            return;
        }

        consoleMethod(message);
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public getLogsByLevel(level: LogLevel): LogEntry[] {
        return this.logs.filter(log => log.level === level);
    }

    public getRecentLogs(minutes: number = LOGGER_RECENT_MINUTES_DEFAULT): LogEntry[] {
        const normalizedMinutes = normalizeMinutes(minutes);
        const cutoffTime = Date.now() - (normalizedMinutes * MILLISECONDS_PER_MINUTE);
        return this.logs.filter(log => log.timestamp > cutoffTime);
    }

    public clear(): void {
        this.logs = [];
        this.stats = { info: 0, warning: 0, error: 0 };
        this.notifySubscribers();
    }

    public subscribe(callback: (logs: LogEntry[]) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers(): void {
        const logsCopy = [...this.logs];
        this.subscribers.forEach(callback => {
            try {
                callback(logsCopy);
            } catch (error) {
                console.error('Logger subscriber error:', error);
            }
        });
    }

    public logPerformance(operation: string, duration: number, source?: string): void {
        const level = duration > LOGGER_PERFORMANCE_THRESHOLD ? LogLevel.WARNING : LogLevel.INFO;
        const message = `Performance: ${operation} took ${duration.toFixed(LOGGER_PERFORMANCE_PRECISION_DIGITS)}ms`;

        this.addLog({
            level,
            message,
            source: source ?? PERFORMANCE_SOURCE,
            data: { operation, duration }
        });
    }

    public logSimulationError(error: Error, context?: string): void {
        const source = context ?? SYSTEM_SOURCE;
        this.error(`Simulation error: ${context ?? ''}`, source, {
            error: error.message,
            stack: error.stack,
            context
        });
    }

    public logSimulationEvent(event: string, data?: Record<string, unknown>): void {
        this.info(`Simulation event: ${event}`, SIMULATION_SOURCE, data);
    }

    public getLogStats(): LoggerStats {
        const recent = this.getRecentLogs(LOGGER_RECENT_MINUTES_STATS).length;
        return {
            total: this.logs.length,
            info: this.stats.info,
            warning: this.stats.warning,
            error: this.stats.error,
            recent
        };
    }

    private isDevelopment(): boolean {
        return import.meta.env.DEV;
    }
}

export const logger = Logger.getInstance();
