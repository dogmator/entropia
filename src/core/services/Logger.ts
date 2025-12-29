import { DEBUG_CONFIG } from '@/config';

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
  private remoteLoggingEnabled: boolean = DEBUG_CONFIG.remoteLoggingEnabled;
  private socket: WebSocket | null = null;
  private messageQueue: LogEntry[] = [];
  private isConnecting: boolean = false;
  private context: string = typeof self !== 'undefined' && typeof window === 'undefined' ? 'Worker' : 'Main';
  private commandSubscribers: Set<(command: any) => void> = new Set();
  private originalConsole: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  } = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

  private constructor() {
    // Приватний конструктор для синглтона
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      Logger.instance.interceptConsole();
    }
    return Logger.instance;
  }

  /**
   * Перехоплення стандартних методів консолі для захоплення всіх логів
   */
  private interceptConsole(): void {
    if (this.context === 'Worker') return;

    // Перевизначення методів консолі
    console.log = (...args) => {
      this.addLog(LogLevel.INFO, args.map(a => this.formatArg(a)).join(' '), 'Console', undefined, true);
      this.originalConsole.log(...args);
    };

    console.info = (...args) => {
      this.addLog(LogLevel.INFO, args.map(a => this.formatArg(a)).join(' '), 'Console', undefined, true);
      this.originalConsole.info(...args);
    };

    console.warn = (...args) => {
      this.addLog(LogLevel.WARNING, args.map(a => this.formatArg(a)).join(' '), 'Console', undefined, true);
      this.originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.addLog(LogLevel.ERROR, args.map(a => this.formatArg(a)).join(' '), 'Console', undefined, true);
      this.originalConsole.error(...args);
    };

    console.debug = (...args) => {
      // Опціонально захоплюємо debug, зазвичай як INFO
      this.addLog(LogLevel.INFO, args.map(a => this.formatArg(a)).join(' '), 'Console (Debug)', undefined, true);
      this.originalConsole.debug(...args);
    };
  }

  private formatArg(arg: any): string {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
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
   * Alias for warning
   */
  public warn(message: string, source?: string, data?: Record<string, unknown>): void {
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
  private addLog(
    level: LogLevel,
    message: string,
    source?: string,
    data?: Record<string, unknown>,
    skipConsole: boolean = false
  ): void {
    if (this.isDuplicateLog(level, message, source, data)) {
      return;
    }

    const entry = this.createLogEntry(level, message, source, data);
    this.logs.push(entry);
    this.cleanupOldLogs();
    this.notifySubscribers();

    if (!skipConsole) {
      this.outputToConsole(level, message, source, data);
    }

    this.maybeSendToRemote(entry);
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
      this.originalConsole[consoleMethod](logMessage, data);
    } else {
      this.originalConsole[consoleMethod](logMessage);
    }
  }

  /**
   * Налаштування віддаленого логування
   */
  public setRemoteLogging(enabled: boolean): void {
    this.remoteLoggingEnabled = enabled;
    if (enabled) {
      this.initWebSocket();
    } else if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Ініціалізація WebSocket з'єднання
   */
  private initWebSocket(): void {
    // Послаблена перевірка: Дозволяємо з'єднання, якщо remoteLoggingEnabled = true, навіть якщо isDevelopment() false/undefined у Worker
    if (this.socket || this.isConnecting || !this.remoteLoggingEnabled) {
      return;
    }

    this.isConnecting = true;

    try {
      this.socket = new WebSocket(DEBUG_CONFIG.remoteWsEndpoint);

      this.socket.onopen = () => {
        this.isConnecting = false;
        console.debug(`[\x1b[36mLogger\x1b[0m] WebSocket connected (${this.context})`);
        this.flushQueue();
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.socket = null;
        if (this.remoteLoggingEnabled) {
          // Авто-перепідключення через 3 секунди
          setTimeout(() => this.initWebSocket(), 3000);
        }
      };

      this.socket.onerror = (error) => {
        this.isConnecting = false;
        console.warn(`[Logger] WebSocket error (${this.context}):`, error);
      };

      this.socket.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const data = JSON.parse(event.data);
          if (data && typeof data === 'object' && data.type === 'COMMAND') {
            this.notifyCommandSubscribers(data);
          }
        } catch (e) {
          console.warn('[Logger] Failed to parse incoming message:', e);
        }
      };
    } catch (error) {
      this.isConnecting = false;
      console.warn(`[Logger] Failed to init WebSocket (${this.context}):`, error);
    }
  }

  /**
   * Очищення черги повідомлень після відновлення зв'язку
   */
  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const entry = this.messageQueue.shift();
      if (entry) this.socket.send(JSON.stringify(entry));
    }
  }

  /**
   * Відправка лога на сервер
   */
  private async maybeSendToRemote(entry: LogEntry): Promise<void> {
    if (!this.remoteLoggingEnabled) {
      return;
    }

    // Додаємо контекст до джерела, якщо він відсутній
    if (entry.source && !entry.source.includes(this.context)) {
      entry.source = `${this.context}:${entry.source}`;
    } else if (!entry.source) {
      entry.source = this.context;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(entry);
      this.initWebSocket();
      return;
    }

    try {
      this.socket.send(JSON.stringify(entry));
    } catch (error) {
      console.warn('[Logger] Failed to send to remote:', error);
      this.messageQueue.push(entry);
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

  /**
   * Підписка на віддалені команди
   */
  public subscribeToCommands(callback: (command: any) => void): () => void {
    this.commandSubscribers.add(callback);
    return () => {
      this.commandSubscribers.delete(callback);
    };
  }

  private notifyCommandSubscribers(command: any): void {
    this.commandSubscribers.forEach(callback => {
      try {
        callback(command);
      } catch (error) {
        console.error('[Logger] Command subscriber error:', error);
      }
    });
  }
}

// Експорт синглтона для зручного використання
export const logger = Logger.getInstance();
