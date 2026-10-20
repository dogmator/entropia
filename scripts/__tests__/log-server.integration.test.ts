 
/* eslint-disable max-lines-per-function */
import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

const SERVER_SCRIPT = path.join(process.cwd(), 'scripts', 'log-server.ts');
const TSX_BIN = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
const LOG_FILE_NAME = 'remote_debug.log';
const STARTUP_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 50;
const OVERSIZED_BYTES = 100_001;
const CLOSE_CODE_MESSAGE_TOO_BIG = 1009;
const BROWSER_ORIGIN = 'http://localhost:13000';
const FOREIGN_ORIGIN = 'https://evil.example';
const REMOTE_TOKEN = 'integration-secret';
const INTEGRATION_OK = 'integration-ok';
const AFTER_GARBAGE = 'after-garbage';

interface RunningServer {
  child: ChildProcess;
  output: () => string;
  port: number;
  tempDir: string;
}

const running: RunningServer[] = [];

const freePort = (): Promise<number> => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    probe.close(() => { resolve(port); });
  });
});

const startServer = async (env: Record<string, string>): Promise<RunningServer> => {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entropia-log-server-'));
  let output = '';
  const child = spawn(TSX_BIN, [SERVER_SCRIPT], {
    cwd: tempDir,
    env: { ...process.env, LOG_SERVER_PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

  const server: RunningServer = { child, output: () => output, port, tempDir };
  running.push(server);

  await vi.waitFor(() => {
    if (child.exitCode !== null) throw new Error(`server exited early: ${output}`);
    if (!output.includes('Address:')) throw new Error('server not ready');
  }, { timeout: STARTUP_TIMEOUT_MS, interval: POLL_INTERVAL_MS });

  return server;
};

const stopServer = async (server: RunningServer): Promise<void> => {
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill('SIGTERM');
    await new Promise<void>((resolve) => { server.child.once('exit', () => { resolve(); }); });
  }
  fs.rmSync(server.tempDir, { recursive: true, force: true });
};

afterEach(async () => {
  for (const server of running.splice(0, running.length)) {
    await stopServer(server);
  }
});

const urlFor = (server: RunningServer, query = ''): string => `ws://127.0.0.1:${String(server.port)}/${query}`;

/** First non-loopback IPv4 address of this machine, or undefined when the host has none. */
const externalIpv4 = (): string | undefined => {
  for (const addresses of Object.values(os.networkInterfaces())) {
    const match = addresses?.find(address => address.family === 'IPv4' && !address.internal);
    if (match) return match.address;
  }
  return undefined;
};

class HandshakeRejected extends Error {
  public readonly status: number;

  constructor(status: number) {
    super(`handshake rejected with HTTP ${String(status)}`);
    this.status = status;
  }
}

const connect = (url: string, headers: Record<string, string> = {}): Promise<WebSocket> => new Promise((resolve, reject) => {
  const ws = new WebSocket(url, { headers });
  ws.once('open', () => { resolve(ws); });
  ws.once('unexpected-response', (_request, response) => { reject(new HandshakeRejected(response.statusCode ?? 0)); });
  ws.once('error', reject);
});

const logFileText = (server: RunningServer): string => {
  const logPath = path.join(server.tempDir, LOG_FILE_NAME);
  return fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
};

const waitForLogText = async (server: RunningServer, text: string): Promise<void> => {
  await vi.waitFor(() => {
    if (!logFileText(server).includes(text)) throw new Error(`log file does not contain "${text}"`);
  }, { timeout: POLL_TIMEOUT_MS, interval: POLL_INTERVAL_MS });
};

describe('log server — running process', () => {
  it('binds to loopback by default and accepts a local client', async () => {
    const server = await startServer({});

    expect(server.output()).toContain(`ws://127.0.0.1:${String(server.port)}`);
    const ws = await connect(urlFor(server));
    ws.close();

    const lanAddress = externalIpv4();
    if (lanAddress !== undefined) {
      await expect(connect(`ws://${lanAddress}:${String(server.port)}/`)).rejects.toThrow();
    }
  }, TEST_TIMEOUT_MS);

  it('rejects a handshake from a foreign web origin with 403', async () => {
    const server = await startServer({});

    await expect(connect(urlFor(server), { Origin: FOREIGN_ORIGIN })).rejects.toMatchObject({ status: 403 });
  }, TEST_TIMEOUT_MS);

  it('accepts a localhost browser origin and writes valid bundles to the log file', async () => {
    const server = await startServer({});
    const ws = await connect(urlFor(server), { Origin: BROWSER_ORIGIN });

    ws.send(JSON.stringify({ message: INTEGRATION_OK, level: 'info', source: 'Test' }));

    await waitForLogText(server, INTEGRATION_OK);
    expect(logFileText(server)).toContain(INTEGRATION_OK);
    ws.close();
  }, TEST_TIMEOUT_MS);

  it('survives an invalid JSON message and keeps processing later bundles', async () => {
    const server = await startServer({});
    const ws = await connect(urlFor(server));

    ws.send('{not valid json');
    ws.send(JSON.stringify({ message: AFTER_GARBAGE }));

    await waitForLogText(server, AFTER_GARBAGE);
    expect(logFileText(server)).toContain(AFTER_GARBAGE);
    expect(server.child.exitCode).toBeNull();
    ws.close();
  }, TEST_TIMEOUT_MS);

  it('closes a connection that exceeds the payload limit and keeps the server available', async () => {
    const server = await startServer({});
    const ws = await connect(urlFor(server));
    const closed = new Promise<number>((resolve) => { ws.once('close', (code) => { resolve(code); }); });

    ws.send(Buffer.alloc(OVERSIZED_BYTES, 'a'));

    expect(await closed).toBe(CLOSE_CODE_MESSAGE_TOO_BIG);
    const next = await connect(urlFor(server));
    next.close();
  }, TEST_TIMEOUT_MS);

  it('refuses to start on a non-loopback host without the remote opt-in', async () => {
    const port = await freePort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entropia-log-server-'));
    let stderr = '';
    const child = spawn(TSX_BIN, [SERVER_SCRIPT], {
      cwd: tempDir,
      env: { ...process.env, LOG_SERVER_PORT: String(port), LOG_SERVER_HOST: '0.0.0.0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const exitCode = await new Promise<number | null>((resolve) => { child.once('exit', (code) => { resolve(code); }); });
    fs.rmSync(tempDir, { recursive: true, force: true });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('LOG_SERVER_ALLOW_REMOTE=1');
  }, TEST_TIMEOUT_MS);

  it('requires the configured token when remote access is explicitly enabled', async () => {
    const server = await startServer({
      LOG_SERVER_HOST: '0.0.0.0',
      LOG_SERVER_ALLOW_REMOTE: '1',
      LOG_SERVER_TOKEN: REMOTE_TOKEN,
    });

    await expect(connect(urlFor(server))).rejects.toMatchObject({ status: 401 });
    await expect(connect(urlFor(server, '?token=wrong'))).rejects.toMatchObject({ status: 401 });
    const ws = await connect(urlFor(server, `?token=${REMOTE_TOKEN}`));
    ws.close();
  }, TEST_TIMEOUT_MS);
});
