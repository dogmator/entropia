import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger, LogLevel } from '../Logger';

interface MockSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
}

const RECONNECT_EXPECTED_CALLS = 2;
const SLOW_OPERATION_DURATION = 101;
const DEFAULT_MAX_LOGS = 1000;
const OVERFLOW_ITERATIONS = 700;
const INVALID_MINUTES = -20;
const BASE_TIME = 2_000_000;
const NEXT_TIME = 2_000_001;
const TRIMMED_MAX_LOGS = 10;
const TRIM_SOURCE_COUNT = 20;
const LARGE_TRIM_SOURCE_COUNT = 120;
const BIGINT_PAYLOAD_VALUE = 42n;
const SOCKET_OPEN_STATE = 1;
const SOCKET_CLOSED_STATE = 0;

const setupGlobalSpies = () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);

  return { warnSpy, setTimeoutSpy };
};

const createLogger = (): Logger => {
  const loggerClass = Logger as unknown as { instance?: Logger };
  loggerClass.instance = undefined;
  return Logger.getInstance();
};

const setupLogger = () => {
  const spies = setupGlobalSpies();
  const logger = createLogger();
  logger.clear();
  logger.setRemoteLogging(false);
  logger.setMaxLogs(DEFAULT_MAX_LOGS);

  return { logger, ...spies };
};

const createSocket = (readyState: number): MockSocket => ({
  readyState,
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
});

const applySocketMock = (socket: MockSocket): ReturnType<typeof vi.fn> => {
  const WebSocketMock = vi.fn(() => socket);
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocketMock as unknown as typeof WebSocket;
  return WebSocketMock;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Logger refactor regression: local flow', () => {
  let logger: Logger;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ({ logger, warnSpy } = setupLogger());
  });

  it('не додає дублікати однакових логів підряд', () => {
    logger.warning('duplicate', 'UnitTest', { value: 1 });
    logger.warning('duplicate', 'UnitTest', { value: 1 });

    expect(logger.getLogs()).toHaveLength(1);
  });

  it('виводить warning у консоль з очікуваним форматом', () => {
    logger.warning('formatted message', 'Formatter');

    expect(warnSpy).toHaveBeenCalledWith('[WARNING] [Formatter]: formatted message');
  });

  it('notifyCommandSubscribers передає COMMAND-повідомлення', () => {
    const callback = vi.fn();
    logger.subscribeToCommands(callback);

    (logger as unknown as {
      notifyCommandSubscribers: (command: { type: 'COMMAND'; payload?: string }) => void;
    }).notifyCommandSubscribers({ type: 'COMMAND', payload: 'ok' });

    expect(callback).toHaveBeenCalledWith({ type: 'COMMAND', payload: 'ok' });
  });

  it('setMaxLogs обрізає колекцію логів без порушення верхньої межі', () => {
    logger.setMaxLogs(TRIMMED_MAX_LOGS);

    for (let index = 0; index < TRIM_SOURCE_COUNT; index += 1) {
      logger.info(`entry-${index}`, 'Trim');
    }

    expect(logger.getLogs().length).toBeLessThanOrEqual(TRIMMED_MAX_LOGS);
  });

  it('setMaxLogs з Infinity використовує fallback значення за замовчуванням', () => {
    logger.setMaxLogs(Number.POSITIVE_INFINITY);

    for (let index = 0; index < LARGE_TRIM_SOURCE_COUNT; index += 1) {
      logger.info(`entry-${index}`, 'TrimInfinity');
    }

    expect(logger.getLogs()).toHaveLength(LARGE_TRIM_SOURCE_COUNT);
  });

  it('getRecentLogs використовує fallback для невалідного minutes', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(BASE_TIME);
    logger.info('event', 'Recent');

    nowSpy.mockReturnValueOnce(NEXT_TIME);
    const recent = logger.getRecentLogs(INVALID_MINUTES);

    expect(recent).toHaveLength(1);
  });

  it('форматує bigint у payload без падіння серіалізації', () => {
    logger.warning('bigint payload', 'Formatter', { value: BIGINT_PAYLOAD_VALUE });

    expect(logger.getLogs()[0]?.message).toBe('bigint payload');
  });
});

describe('Logger refactor regression: remote flow reconnect/performance', () => {
  let logger: Logger;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ({ logger, setTimeoutSpy } = setupLogger());
  });

  it('при розриві websocket планує reconnect', () => {
    const socket = createSocket(SOCKET_OPEN_STATE);
    const WebSocketMock = applySocketMock(socket);

    logger.setRemoteLogging(true);
    socket.onclose?.();

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(WebSocketMock).toHaveBeenCalledTimes(RECONNECT_EXPECTED_CALLS);
  });

  it('logPerformance підіймає рівень до warning при перевищенні порогу', () => {
    logger.logPerformance('step', SLOW_OPERATION_DURATION, 'Perf');

    const warningLogs = logger.getLogsByLevel(LogLevel.WARNING);
    expect(warningLogs).toHaveLength(1);
    expect(warningLogs[0]?.message).toContain('step');
  });
});

describe('Logger refactor regression: remote flow queue policies', () => {
  let logger: Logger;

  beforeEach(() => {
    ({ logger } = setupLogger());
  });

  it('не мутує локальний source при remote enqueue', () => {
    applySocketMock(createSocket(SOCKET_CLOSED_STATE));

    logger.setRemoteLogging(true);
    logger.info('message', 'DomainSource');

    expect(logger.getLogs()[0]?.source).toBe('DomainSource');
  });

  it('обрізає remote queue при переповненні', () => {
    applySocketMock(createSocket(SOCKET_CLOSED_STATE));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logger.setRemoteLogging(true);

    for (let index = 0; index < OVERFLOW_ITERATIONS; index += 1) {
      logger.info(`overflow-${index}`, 'Remote');
    }

    expect(warnSpy).toHaveBeenCalledWith('[Logger] Remote queue overflow. Old entries were dropped.');
  });
});
