import { DEBUG_CONFIG } from '@/config';

import { WebSocketTransport } from './transports/WebSocketTransport';
import { LogEntry, LoggerStats,LogLevel } from './types';

// Константи Logger
const LOGGER_MAX_LOGS = 1000;
const LOGGER_RECENT_MINUTES_DEFAULT = 10;
const LOGGER_RECENT_MINUTES_STATS = 5;
const LOGGER_PERFORMANCE_THRESHOLD = 100;
const LOGGER_CLEANUP_PERCENTAGE = 0.1;
const MILLISECONDS_PER_MINUTE = 60 * 1000;

/**
 * Logger — Централізована система логування дляEntropia 3D.
 * Підтримує локальне зберігання логів для UI та віддалену передачу через транспорти.
 */
export class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private subscribers: Set<(logs: LogEntry[]) => void> = new Set();
    private transport: WebSocketTransport;

    private constructor() {
        this.transport = new WebSocketTransport();
        this.transport.setEnabled(DEBUG_CONFIG.remoteLoggingEnabled && this.isDevelopment());
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Налаштування віддаленого логування
     */
    public setRemoteLogging(enabled: boolean): void {
        this.transport.setEnabled(enabled && this.isDevelopment());
    }

    public info(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog(LogLevel.INFO, message, source, data);
    }

    public warning(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog(LogLevel.WARNING, message, source, data);
    }

    public error(message: string, source?: string, data?: Record<string, unknown>): void {
        this.addLog(LogLevel.ERROR, message, source, data);
    }

    private addLog(level: LogLevel, message: string, source?: string, data?: Record<string, unknown>): void {
        if (this.isDuplicateLog(level, message, source, data)) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            source,
            data
        };

        this.logs.push(entry);
        this.cleanupOldLogs();
        this.notifySubscribers();
        this.outputToConsole(level, message, source, data);
        this.transport.send(entry);
    }

    private isDuplicateLog(level: LogLevel, message: string, source?: string, data?: Record<string, unknown>): boolean {
        if (this.logs.length === 0) return false;
        const lastLog = this.logs[this.logs.length - 1];
        return !!(
            lastLog &&
            lastLog.level === level &&
            lastLog.message === message &&
            lastLog.source === source &&
            JSON.stringify(lastLog.data) === JSON.stringify(data)
        );
    }

    private cleanupOldLogs(): void {
        if (this.logs.length > LOGGER_MAX_LOGS) {
            const removeCount = Math.floor(LOGGER_MAX_LOGS * LOGGER_CLEANUP_PERCENTAGE);
            this.logs.splice(0, removeCount);
        }
    }

    private outputToConsole(level: LogLevel, message: string, source?: string, data?: Record<string, unknown>): void {
        if (level !== LogLevel.ERROR && level !== LogLevel.WARNING) return;

        const sourcePrefix = source ? ` [${source}]` : '';
        const logMessage = `[${level.toUpperCase()}]${sourcePrefix}: ${message}`;
        const consoleMethod = level === LogLevel.ERROR ? 'error' : 'warn';

        if (data) {
            console[consoleMethod](logMessage, data);
        } else {
            console[consoleMethod](logMessage);
        }
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public getRecentLogs(minutes: number = LOGGER_RECENT_MINUTES_DEFAULT): LogEntry[] {
        const cutoffTime = Date.now() - (minutes * MILLISECONDS_PER_MINUTE);
        return this.logs.filter(log => log.timestamp > cutoffTime);
    }

    public clear(): void {
        this.logs = [];
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
        const message = `Performance: ${operation} took ${duration.toFixed(2)}ms`;
        this.addLog(level, message, source || 'Performance', { operation, duration });
    }

    public logSimulationError(error: Error, context?: string): void {
        this.error(`Simulation error: ${context}`, context || 'System', {
            error: error.message,
            stack: error.stack,
            context
        });
    }

    public logSimulationEvent(event: string, data?: Record<string, unknown>): void {
        this.info(`Simulation event: ${event}`, 'Simulation', data);
    }

    public getLogStats(): LoggerStats {
        const total = this.logs.length;
        const info = this.logs.filter(l => l.level === LogLevel.INFO).length;
        const warning = this.logs.filter(l => l.level === LogLevel.WARNING).length;
        const error = this.logs.filter(l => l.level === LogLevel.ERROR).length;
        const recent = this.getRecentLogs(LOGGER_RECENT_MINUTES_STATS).length;
        return { total, info, warning, error, recent };
    }

    private isDevelopment(): boolean {
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                // @ts-ignore
                return !!import.meta.env.DEV;
            }
            if (typeof process !== 'undefined' && process.env) {
                return process.env['NODE_ENV'] === 'development';
            }
        } catch (e) { }
        return false;
    }
}

export const logger = Logger.getInstance();
