import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const DEFAULT_REPORT_RELATIVE_PATH = path.join('test-results', 'smoke', 'smoke-report.md');
const STOP_TIMEOUT_MS = 5_000;
const MIN_PORT = 1;
const MAX_PORT = 65_535;

/** Thrown when a dedicated test port is already taken. The harness never frees a port by killing its owner. */
export class PortInUseError extends Error {
    public readonly port: number;

    constructor(port: number) {
        super(`Port ${String(port)} is already in use. Refusing to start: the smoke test does not kill foreign processes. Choose another SMOKE_*_PORT.`);
        this.port = port;
    }
}

/** Processes started by this harness. Each one leads its own process group, so signals never reach strangers. */
const owned = new Set<ChildProcess>();

/** Resolves a port from the environment, validating it strictly. */
export const readEnvPort = (env: NodeJS.ProcessEnv, name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const port = Number(raw);
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
        throw new Error(`${name} must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}, got "${raw}"`);
    }

    return port;
};

/** Resolves where the smoke report is written. The tracked docs/ reports are only overwritten on explicit request. */
export const resolveReportPath = (root: string, requested: string | undefined): string => {
    const trimmed = requested?.trim();
    return path.resolve(root, trimmed === undefined || trimmed === '' ? DEFAULT_REPORT_RELATIVE_PATH : trimmed);
};

/** Resolves when nothing accepts connections on the port; rejects with PortInUseError otherwise. */
export const assertPortAvailable = (port: number): Promise<void> => new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', (error: NodeJS.ErrnoException) => {
        reject(error.code === 'EADDRINUSE' ? new PortInUseError(port) : error);
    });

    probe.listen({ port }, () => {
        probe.close(() => { resolve(); });
    });
});

/** Starts a child process in its own process group and records it as owned by this harness. */
export const spawnOwned = (command: string, args: readonly string[], options: { cwd: string; env: NodeJS.ProcessEnv }): ChildProcess => {
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    owned.add(child);
    child.once('exit', () => { owned.delete(child); });
    return child;
};

const killWindowsTree = (pid: number): void => {
    try {
        // taskkill is a fixed Windows system tool. /T takes the whole tree, which process groups do not exist for here.
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed system tool, PID is ours
        execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
        /* the tree has already exited */
    }
};

// Signals the whole process group on POSIX. Windows has no process groups, and a negative PID throws there,
// so the direct child is signalled instead. Falling back to child.kill also guarantees that the child's
// 'exit' event fires, so stopOwned can never wait forever.
const signalGroup = (child: ChildProcess, signal: NodeJS.Signals): void => {
    if (child.pid === undefined) {
        return;
    }

    if (process.platform === 'win32') {
        killWindowsTree(child.pid);
    } else {
        try {
            process.kill(-child.pid, signal);
        } catch {
            /* the group has already exited, or was never created */
        }
    }

    child.kill(signal);
};

/** Stops one owned process group: SIGTERM first, SIGKILL after the timeout. */
export const stopOwned = async (child: ChildProcess, timeoutMs: number = STOP_TIMEOUT_MS): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    const exited = new Promise<void>((resolve) => { child.once('exit', () => { resolve(); }); });
    signalGroup(child, 'SIGTERM');

    let timer: NodeJS.Timeout | undefined;
    const escalated = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
            signalGroup(child, 'SIGKILL');
            resolve();
        }, timeoutMs);
    });

    await Promise.race([exited, escalated]);
    clearTimeout(timer);
    await exited;
};

/** Stops every process this harness started. Processes it did not start are left untouched. */
export const stopAllOwned = async (): Promise<void> => {
    await Promise.all([...owned].map(child => stopOwned(child)));
};

/** Synchronous, last-resort cleanup for process exit and termination signals. */
export const killAllOwnedSync = (): void => {
    for (const child of owned) {
        signalGroup(child, 'SIGKILL');
    }
};
