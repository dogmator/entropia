/* eslint-disable @typescript-eslint/no-magic-numbers */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from '../Logger.service';

const OPEN_STATE = 1;
const CLOSED_STATE = 3;
const SEND_FAILURE = 'send failed';

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((event?: unknown) => void) | null;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

const createSocket = (readyState: number): FakeSocket => ({
  readyState,
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
});

const installWebSocket = (factory: () => FakeSocket): void => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = vi.fn(factory);
  (globalThis as unknown as { WebSocket: { OPEN: number } }).WebSocket.OPEN = OPEN_STATE;
};

const freshLogger = (): Logger => {
  const loggerClass = Logger as unknown as { instance?: Logger };
  delete loggerClass.instance;
  const logger = Logger.getInstance();
  logger.clear();
  logger.setMaxLogs(1000);
  return logger;
};

let originalWebSocket: unknown;

beforeEach(() => {
  originalWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  (globalThis as unknown as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  vi.restoreAllMocks();
});

// The diagnostics channel is optional. A failure in it must never break the application's own logging.
describe('Logger — WebSocket diagnostics failures do not break the app', () => {
  it('keeps logging locally when the WebSocket constructor throws', () => {
    installWebSocket(() => { throw new Error('SecurityError: blocked'); });
    const logger = freshLogger();

    expect(() => { logger.setRemoteLogging(true); }).not.toThrow();
    // One constructor attempt per initialisation: the failure must not re-enter initialisation through console capture.
    expect((globalThis as unknown as { WebSocket: unknown }).WebSocket).toHaveBeenCalledTimes(1);
    expect(() => { logger.info('still works', 'App'); }).not.toThrow();

    expect(logger.getLogs().some(entry => entry.message === 'still works')).toBe(true);
  });

  it('does not throw when send() fails on an open socket, and keeps the entry for retry', () => {
    const socket = createSocket(OPEN_STATE);
    socket.send.mockImplementation(() => { throw new Error(SEND_FAILURE); });
    installWebSocket(() => socket);
    const logger = freshLogger();
    logger.setRemoteLogging(true);

    expect(() => { logger.info('entry during send failure', 'App'); }).not.toThrow();

    expect(logger.getLogs().some(entry => entry.message === 'entry during send failure')).toBe(true);
  });

  it('does not throw on a socket error event and reports it through the local log', () => {
    const socket = createSocket(CLOSED_STATE);
    installWebSocket(() => socket);
    const logger = freshLogger();
    logger.setRemoteLogging(true);

    expect(() => { socket.onerror?.({}); }).not.toThrow();

    expect(logger.getLogs().some(entry => entry.message.includes('remote log WS error'))).toBe(true);
  });

  it('ignores a malformed message from the server without throwing', () => {
    const socket = createSocket(OPEN_STATE);
    installWebSocket(() => socket);
    freshLogger().setRemoteLogging(true);

    expect(() => { socket.onmessage?.({ data: '{not json' }); }).not.toThrow();
    expect(() => { socket.onmessage?.({ data: 42 }); }).not.toThrow();
  });

  it('never opens a socket while remote logging is disabled', () => {
    const factory = vi.fn(() => createSocket(OPEN_STATE));
    installWebSocket(factory);
    const logger = freshLogger();

    logger.info('local only', 'App');

    expect(factory).not.toHaveBeenCalled();
    expect(logger.getLogs().some(entry => entry.message === 'local only')).toBe(true);
  });
});
