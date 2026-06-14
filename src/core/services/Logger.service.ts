import { DEBUG_CONFIG } from '@/config';

export enum LogLevel {
  DEBUG = 'debug',
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

interface LogPayload {
  level: LogLevel;
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}

interface AddLogOptions {
  skipConsole?: boolean;
}

interface ConsoleCapturePayload {
  level: LogLevel;
  source: string;
  args: unknown[];
}

interface RemoteCommand {
  type: 'COMMAND';
  [key: string]: unknown;
}

interface DedupComparable {
  level: LogLevel;
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}

const LOGGER_MAX_LOGS = 1000;
const LOGGER_RECENT_MINUTES_DEFAULT = 10;
const LOGGER_RECENT_MINUTES_STATS = 5;
const LOGGER_PERFORMANCE_THRESHOLD = 100;
const LOGGER_CLEANUP_PERCENTAGE = 0.1;
const LOGGER_CLEANUP_MIN_COUNT = 1;
const LOGGER_RECONNECT_DELAY_MS = 3000;
const LOGGER_REMOTE_QUEUE_MAX_SIZE = 500;
const LOGGER_REMOTE_QUEUE_DROP_COUNT = 50;
const MILLISECONDS_PER_MINUTE = 60_000;
const CONSOLE_SOURCE = 'Console';
const CONSOLE_DEBUG_SOURCE = 'Console (Debug)';
const PERFORMANCE_PRECISION_DIGITS = 2;
const PERFORMANCE_SOURCE = 'Performance';
const DEFAULT_SOURCE = 'System';
const SIMULATION_SOURCE = 'Simulation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeMinutes = (minutes: number): number =>
  Number.isFinite(minutes) && minutes > 0 ? minutes : LOGGER_RECENT_MINUTES_DEFAULT;

const stringifyReplacer = () => {
  const seen = new WeakSet();

  return (_key: string, currentValue: unknown): unknown => {
    if (typeof currentValue === 'bigint') {
      return currentValue.toString();
    }

    if (typeof currentValue !== 'object' || currentValue === null) {
      return currentValue;
    }

    if (seen.has(currentValue)) {
      return '[Circular]';
    }

    seen.add(currentValue);
    return currentValue;
  };
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, stringifyReplacer());
  } catch {
    return '[Unserializable]';
  }
};

const normalizeMaxLogs = (maxLogs: number): number => {
  if (!Number.isFinite(maxLogs)) {
    return LOGGER_MAX_LOGS;
  }

  return Math.max(1, Math.floor(maxLogs));
};

const getDedupKey = (payload: DedupComparable): string =>
  [payload.level, payload.message, payload.source ?? '', safeStringify(payload.data ?? null)].join('|');

const shouldOutputToConsole = (level: LogLevel): boolean =>
  level === LogLevel.WARNING || level === LogLevel.ERROR;


const buildConsoleMessage = (payload: LogPayload): string => {
  const sourcePrefix = payload.source ? ` [${payload.source}]` : '';
  return `[${payload.level.toUpperCase()}]${sourcePrefix}: ${payload.message}`;
};

const resolveRuntimeEnvironment = (): 'browser' | 'worker' | 'node' => {
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    return 'worker';
  }

  if (typeof window !== 'undefined') {
    return 'browser';
  }

  return 'node';
};

export class Logger {
  private static instance: Logger | undefined;
  private logs: LogEntry[] = [];
  private maxLogs: number = LOGGER_MAX_LOGS;
  private readonly subscribers = new Set<(logs: LogEntry[]) => void>();
  private remoteLoggingEnabled: boolean = DEBUG_CONFIG.remoteLoggingEnabled;
  private socket: WebSocket | null = null;
  private messageQueue: LogEntry[] = [];
  private isConnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly context: string = resolveRuntimeEnvironment() === 'worker' ? 'Worker' : 'Main';
  private readonly commandSubscribers = new Set<(command: RemoteCommand) => void>();
  private lastLogDedupKey: string | null = null;
  private readonly originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  private constructor() {
    // singleton
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      Logger.instance.interceptConsole();
    }

    return Logger.instance;
  }

  private interceptConsole(): void {
    if (resolveRuntimeEnvironment() === 'worker') {
      return;
    }

    console.log = (...args) => { this.captureConsoleMessage({ level: LogLevel.INFO, source: CONSOLE_SOURCE, args }, this.originalConsole.log); };
    console.info = (...args) => { this.captureConsoleMessage({ level: LogLevel.INFO, source: CONSOLE_SOURCE, args }, this.originalConsole.info); };
    console.warn = (...args) => { this.captureConsoleMessage({ level: LogLevel.WARNING, source: CONSOLE_SOURCE, args }, this.originalConsole.warn); };
    console.error = (...args) => { this.captureConsoleMessage({ level: LogLevel.ERROR, source: CONSOLE_SOURCE, args }, this.originalConsole.error); };
    console.debug = (...args) => { this.captureConsoleMessage({ level: LogLevel.DEBUG, source: CONSOLE_DEBUG_SOURCE, args }, this.originalConsole.debug); };
  }

  private captureConsoleMessage(
    payload: ConsoleCapturePayload,
    outputMethod: (...args: unknown[]) => void
  ): void {
    this.addLog({
      level: payload.level,
      source: payload.source,
      message: payload.args.map(arg => this.formatArg(arg)).join(' ')
    }, { skipConsole: true });

    outputMethod(...payload.args);
  }

  private formatArg(arg: unknown): string {
    if (isRecord(arg) || Array.isArray(arg)) {
      return safeStringify(arg);
    }

    return String(arg);
  }

  public setMaxLogs(maxLogs: number): void {
    this.maxLogs = normalizeMaxLogs(maxLogs);
    this.cleanupOldLogs();
  }

  public debug(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog({ level: LogLevel.DEBUG, message, source, data });
  }

  public info(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog({ level: LogLevel.INFO, message, source, data });
  }

  public warning(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog({ level: LogLevel.WARNING, message, source, data });
  }

  public warn(message: string, source?: string, data?: Record<string, unknown>): void {
    this.warning(message, source, data);
  }

  public error(message: string, source?: string, data?: Record<string, unknown>): void {
    this.addLog({ level: LogLevel.ERROR, message, source, data });
  }

  private addLog(payload: LogPayload, options: AddLogOptions = {}): void {
    if (this.isDuplicateLog(payload)) {
      return;
    }

    const entry = this.createLogEntry(payload);
    this.logs.push(entry);
    this.lastLogDedupKey = getDedupKey(entry);
    this.cleanupOldLogs();
    this.notifySubscribers();

    if (!options.skipConsole && shouldOutputToConsole(payload.level)) {
      this.outputToConsole(payload);
    }

    this.maybeSendToRemote(entry);
  }

  private isDuplicateLog(payload: LogPayload): boolean {
    if (this.logs.length === 0 || !this.lastLogDedupKey) {
      return false;
    }

    return this.lastLogDedupKey === getDedupKey(payload);
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

  private cleanupOldLogs(): void {
    if (this.logs.length <= this.maxLogs) {
      return;
    }

    const overflowCount = this.logs.length - this.maxLogs;
    const removeCount = Math.max(
      LOGGER_CLEANUP_MIN_COUNT,
      overflowCount,
      Math.floor(this.maxLogs * LOGGER_CLEANUP_PERCENTAGE)
    );

    this.logs.splice(0, removeCount);
    const lastLog = this.logs[this.logs.length - 1];
    this.lastLogDedupKey = lastLog ? getDedupKey(lastLog) : null;
  }

  private outputToConsole(payload: LogPayload): void {
    const consoleMethod = payload.level === LogLevel.ERROR ? this.originalConsole.error : this.originalConsole.warn;
    const message = buildConsoleMessage(payload);

    if (payload.data) {
      consoleMethod(message, payload.data);
      return;
    }

    consoleMethod(message);
  }

  public setRemoteLogging(isEnabled: boolean): void {
    if (this.remoteLoggingEnabled === isEnabled) {
      return;
    }

    this.remoteLoggingEnabled = isEnabled;

    if (!isEnabled) {
      this.clearRemoteState();
      return;
    }

    this.initWebSocket();
  }

  private clearRemoteState(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.messageQueue = [];
    this.isConnecting = false;
  }

  private initWebSocket(): void {
    if (this.socket || this.isConnecting || !this.remoteLoggingEnabled) {
      return;
    }

    this.isConnecting = true;

    try {
      this.socket = new WebSocket(DEBUG_CONFIG.remoteWsEndpoint);
      this.bindWebSocketEvents();
    } catch (error) {
      this.isConnecting = false;
      console.warn(`[Logger] Failed to init WebSocket (${this.context}):`, error);
      this.scheduleReconnect();
    }
  }

  private bindWebSocketEvents(): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = () => {
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      console.debug(`[\x1b[36mLogger\x1b[0m] WebSocket connected (${this.context})`);
      this.flushQueue();
    };

    this.socket.onclose = () => {
      this.isConnecting = false;
      this.socket = null;
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
      this.isConnecting = false;
      console.warn(`[Logger] WebSocket error (${this.context}):`, error);
    };

    this.socket.onmessage = (event) => {
      this.handleIncomingMessage(event.data);
    };
  }

  private scheduleReconnect(): void {
    if (!this.remoteLoggingEnabled || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, LOGGER_RECONNECT_DELAY_MS);
  }

  private handleIncomingMessage(data: unknown): void {
    if (typeof data !== 'string') {
      return;
    }

    try {
      const parsed = JSON.parse(data) as unknown;
      if (this.isRemoteCommand(parsed)) {
        this.notifyCommandSubscribers(parsed);
      }
    } catch (error) {
      console.warn('[Logger] Failed to parse incoming message:', error);
    }
  }

  private isRemoteCommand(value: unknown): value is RemoteCommand {
    return isRecord(value) && value['type'] === 'COMMAND';
  }

  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const entry = this.messageQueue.shift();
      if (!entry) {
        continue;
      }

      try {
        this.socket.send(safeStringify(entry));
      } catch (error) {
        this.messageQueue.unshift(entry);
        console.warn('[Logger] Failed to flush queue entry:', error);
        this.scheduleReconnect();
        break;
      }
    }
  }

  private maybeSendToRemote(entry: LogEntry): void {
    if (!this.remoteLoggingEnabled) {
      return;
    }

    const remoteEntry = this.createRemoteLogEntry(entry);

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.enqueueRemoteEntry(remoteEntry);
      this.initWebSocket();
      return;
    }

    try {
      this.socket.send(safeStringify(remoteEntry));
    } catch (error) {
      console.warn('[Logger] Failed to send to remote:', error);
      this.enqueueRemoteEntry(remoteEntry);
      this.scheduleReconnect();
    }
  }

  private createRemoteLogEntry(entry: LogEntry): LogEntry {
    let source = this.context;
    if (entry.source) {
      source = entry.source.includes(this.context) ? entry.source : `${this.context}:${entry.source}`;
    }

    return {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      source,
      data: entry.data
    };
  }

  private enqueueRemoteEntry(entry: LogEntry): void {
    this.messageQueue.push(entry);

    if (this.messageQueue.length <= LOGGER_REMOTE_QUEUE_MAX_SIZE) {
      return;
    }

    this.messageQueue.splice(0, LOGGER_REMOTE_QUEUE_DROP_COUNT);
    console.warn('[Logger] Remote queue overflow. Old entries were dropped.');
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
    this.lastLogDedupKey = null;
    this.notifySubscribers();
  }

  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    const logsCopy = [...this.logs];
    this.subscribers.forEach(callback => {
      try {
        callback(logsCopy);
      } catch (error) {
        this.originalConsole.error('Logger subscriber error:', error);
      }
    });
  }

  public logPerformance(operation: string, duration: number, source?: string): void {
    const level = duration > LOGGER_PERFORMANCE_THRESHOLD ? LogLevel.WARNING : LogLevel.INFO;
    const message = `Performance: ${operation} took ${duration.toFixed(PERFORMANCE_PRECISION_DIGITS)}ms`;
    this.addLog({
      level,
      message,
      source: source ?? PERFORMANCE_SOURCE,
      data: { operation, duration }
    });
  }

  public logSimulationError(error: Error, context?: string): void {
    this.error(`Simulation error: ${context ?? ''}`, context ?? DEFAULT_SOURCE, {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  public logSimulationEvent(event: string, data?: Record<string, unknown>): void {
    this.info(`Simulation event: ${event}`, SIMULATION_SOURCE, data);
  }

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

  public subscribeToCommands(callback: (command: RemoteCommand) => void): () => void {
    this.commandSubscribers.add(callback);
    return () => {
      this.commandSubscribers.delete(callback);
    };
  }

  private notifyCommandSubscribers(command: RemoteCommand): void {
    this.commandSubscribers.forEach(callback => {
      try {
        callback(command);
      } catch (error) {
        this.originalConsole.error('[Logger] Command subscriber error:', error);
      }
    });
  }
}

export const logger = Logger.getInstance();
