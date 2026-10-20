/* eslint-disable @typescript-eslint/no-magic-numbers */
import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    assertPortAvailable,
    PortInUseError,
    readEnvPort,
    resolveReportPath,
    spawnOwned,
    stopAllOwned,
    stopOwned
} from '../smoke-harness';

const IDLE_SCRIPT = 'setInterval(() => {}, 1000);';
const IGNORE_TERM_SCRIPT = "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000);";
const LISTEN_SCRIPT = (port: number): string =>
    `require('node:net').createServer().listen(${String(port)}, '127.0.0.1'); setInterval(() => {}, 1000);`;
const ROOT = process.cwd();
const FOREIGN_WAIT_MS = 5_000;

const foreignChildren: ChildProcess[] = [];
const servers: net.Server[] = [];

afterEach(async () => {
    await stopAllOwned();
    for (const child of foreignChildren.splice(0)) child.kill('SIGKILL');
    for (const server of servers.splice(0)) server.close();
});

const freePort = (): Promise<number> => new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        probe.close(() => { resolve(port); });
    });
});

const canConnect = (port: number): Promise<boolean> => new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { resolve(false); });
});

const isAlive = (pid: number | undefined): boolean => {
    if (pid === undefined) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

const spawnForeign = (script: string): ChildProcess => {
    const child = spawn(process.execPath, ['-e', script], { stdio: 'ignore' });
    foreignChildren.push(child);
    return child;
};

const spawnIdle = (script: string = IDLE_SCRIPT): ChildProcess =>
    spawnOwned(process.execPath, ['-e', script], { cwd: ROOT, env: process.env });

describe('smoke harness — port safety', () => {
    it('resolves for a free port and releases it afterwards', async () => {
        const port = await freePort();

        await expect(assertPortAvailable(port)).resolves.toBeUndefined();

        const server = net.createServer().listen(port, '127.0.0.1');
        servers.push(server);
        await vi.waitFor(() => { expect(server.listening).toBe(true); });
    });

    it('rejects a busy port without touching the process that owns it', async () => {
        const port = await freePort();
        const owner = net.createServer();
        servers.push(owner);
        await new Promise<void>((resolve) => { owner.listen(port, '127.0.0.1', () => { resolve(); }); });

        await expect(assertPortAvailable(port)).rejects.toBeInstanceOf(PortInUseError);
        expect(await canConnect(port)).toBe(true);
    });
});

describe('smoke harness — owned processes', () => {
    it('stops an owned process group and reports that it was terminated', async () => {
        const child = spawnIdle();
        expect(isAlive(child.pid)).toBe(true);

        await stopOwned(child);

        expect(child.signalCode).toBe('SIGTERM');
        expect(isAlive(child.pid)).toBe(false);
    });

    it('escalates to SIGKILL when an owned process ignores SIGTERM', async () => {
        const child = spawnIdle(IGNORE_TERM_SCRIPT);
        // Wait until the handler is registered; signalling earlier would test the default action instead.
        await new Promise<void>((resolve) => { child.stdout?.once('data', () => { resolve(); }); });

        await stopOwned(child, 200);

        expect(child.signalCode).toBe('SIGKILL');
    });

    it('stopAllOwned never signals a foreign process, even one holding a smoke port', async () => {
        const port = await freePort();
        const foreign = spawnForeign(LISTEN_SCRIPT(port));
        await vi.waitFor(async () => { expect(await canConnect(port)).toBe(true); }, { timeout: FOREIGN_WAIT_MS });
        const owned = spawnIdle();

        await stopAllOwned();

        expect(owned.signalCode).toBe('SIGTERM');
        expect(foreign.exitCode).toBeNull();
        expect(foreign.signalCode).toBeNull();
        expect(await canConnect(port)).toBe(true);
    });
});

describe('smoke harness — configuration', () => {
    it('reads smoke ports from the environment and validates them', () => {
        expect(readEnvPort({}, 'SMOKE_APP_PORT', 13000)).toBe(13000);
        expect(readEnvPort({ SMOKE_APP_PORT: '  ' }, 'SMOKE_APP_PORT', 13000)).toBe(13000);
        expect(readEnvPort({ SMOKE_APP_PORT: '14000' }, 'SMOKE_APP_PORT', 13000)).toBe(14000);
        for (const bad of ['0', '70000', 'x', '1.5']) {
            expect(() => readEnvPort({ SMOKE_APP_PORT: bad }, 'SMOKE_APP_PORT', 13000), bad).toThrow('SMOKE_APP_PORT');
        }
    });

    it('writes the report under test-results by default, never over the tracked docs', () => {
        const defaultPath = resolveReportPath(ROOT, undefined);

        expect(defaultPath.startsWith(path.join(ROOT, 'test-results'))).toBe(true);
        expect(defaultPath.startsWith(path.join(ROOT, 'docs'))).toBe(false);
        expect(resolveReportPath(ROOT, '  ')).toBe(defaultPath);
    });

    it('writes to an explicitly requested report path', () => {
        expect(resolveReportPath(ROOT, 'docs/cycles/logger-payloads/smoke-report.md')).toBe(
            path.join(ROOT, 'docs', 'cycles', 'logger-payloads', 'smoke-report.md')
        );
    });
});
