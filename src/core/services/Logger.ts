/**
 * Logger - система логування для діагностики додатку
 * Збирає системні події та помилки для відображення в діагностичному UI
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

// Константи для Logger
const LOGGER_MAX_LOGS = 1000;
const LOGGER_RECENT_MINUTES_DEFAULT = 10;
const LOGGER_RECENT_MINUTES_STATS = 5;
const LOGGER_PERFORMANCE_THRESHOLD = 100;
const LOGGER_CLEANUP_PERCENTAGE = 0.1;
const MILLISECONDS_PER_MINUTE = 60 * 1000;

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = LOGGER_MAX_LOGS;
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set();

  private constructor() {
    // Приватний конструктор для синглтона
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Додавання інформаційного повідомлення
   */
  public info(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog(LogLevel.INFO, message, source, data);
  }

  /**
   * Додавання попередження
   */
  public warning(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog(LogLevel.WARNING, message, source, data);
  }

  /**
   * Додавання помилки
   */
  public error(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog(LogLevel.ERROR, message, source, data);
  }

  /**
   * Додавання лога з вказаним рівнем
   */
  private addLog(level: LogLevel, message: string, source?: string, data?: Record<string, unknown>): void {
    if (this.isDuplicateLog(level, message, source, data)) {
      return;
    }

    const entry = this.createLogEntry(level, message, source, data);
    this.logs.push(entry);
    this.cleanupOldLogs();
    this.notifySubscribers();
    this.outputToConsole(level, message, source, data);
  }

  private isDuplicateLog(
    level: LogLevel,
    message: string,
    source?: string,
    data?: Record<string, unknown>
  ): boolean {
    if (this.logs.length === 0) {
      return false;
    }

    const lastLog = this.logs[this.logs.length - 1];
    return !!(
      lastLog &&
      lastLog.level === level &&
      lastLog.message === message &&
      lastLog.source === source &&
      JSON.stringify(lastLog.data) === JSON.stringify(data)
    );
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    source?: string,
    data?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      message,
      source,
      data
    };
  }

  private cleanupOldLogs(): void {
    if (this.logs.length > this.maxLogs) {
      const removeCount = Math.max(1, Math.floor(this.maxLogs * LOGGER_CLEANUP_PERCENTAGE));
      this.logs.splice(0, removeCount);
    }
  }

  private outputToConsole(
    level: LogLevel,
    message: string,
    source?: string,
    data?: Record<string, unknown>
  ): void {
    if (level !== LogLevel.ERROR && level !== LogLevel.WARNING) {
      return;
    }

    const sourcePrefix = source ? ` [${source}]` : '';
    const logMessage = `[${level.toUpperCase()}]${sourcePrefix}: ${message}`;
    const consoleMethod = level === LogLevel.ERROR ? 'error' : 'warn';

    if (data) {
      console[consoleMethod](logMessage, data);
    } else {
      console[consoleMethod](logMessage);
    }
  }

  /**
   * Отримання всіх логів
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Отримання логів з фільтрацією за рівнем
   */
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Отримання логів за останні N хвилин
   */
  public getRecentLogs(minutes: number = LOGGER_RECENT_MINUTES_DEFAULT): LogEntry[] {
    const cutoffTime = Date.now() - (minutes * MILLISECONDS_PER_MINUTE);
    return this.logs.filter(log => log.timestamp > cutoffTime);
  }

  /**
   * Очищення всіх логів
   */
  public clear(): void {
    this.logs = [];
    this.notifySubscribers();
  }

  /**
   * Підписка на зміни логів
   */
  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback);

    // Повертаємо функцію відписки
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Повідомлення підписників про зміни
   */
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

  /**
   * Логування продуктивності
   */
  public logPerformance(operation: string, duration: number, source?: string): void {
    const level = duration > LOGGER_PERFORMANCE_THRESHOLD ? LogLevel.WARNING : LogLevel.INFO;
    const message = `Performance: ${operation} took ${duration.toFixed(2)}ms`;
    this.addLog(level, message, source || 'Performance', { operation, duration });
  }

  /**
   * Логування помилок симуляції
   */
  public logSimulationError(error: Error, context?: string): void {
    this.error(`Simulation error: ${context}`, context || 'System', {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Логування подій симуляції
   */
  public logSimulationEvent(event: string, data?: Record<string, unknown>): void {
    this.info(`Simulation event: ${event}`, 'Simulation', data);
  }

  /**
   * Отримання статистики за логами
   */
  public getLogStats(): {
    total: number;
    info: number;
    warning: number;
    error: number;
    recent: number;
  } {
    const total = this.logs.length;
    const info = this.logs.filter(log => log.level === LogLevel.INFO).length;
    const warning = this.logs.filter(log => log.level === LogLevel.WARNING).length;
    const error = this.logs.filter(log => log.level === LogLevel.ERROR).length;
    const recent = this.getRecentLogs(LOGGER_RECENT_MINUTES_STATS).length;

    return { total, info, warning, error, recent };
  }
}

// Експорт синглтона для зручного використання
export const logger = Logger.getInstance();
