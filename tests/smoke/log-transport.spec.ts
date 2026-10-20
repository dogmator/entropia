import { type ChildProcess, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { type Browser, type BrowserContext, type ConsoleMessage, expect, type Page,test } from '@playwright/test';

import {
    assertPortAvailable,
    killAllOwnedSync,
    readEnvPort,
    resolveReportPath,
    spawnOwned,
    stopAllOwned,
    stopOwned
} from '../../scripts/smoke-harness';

const ROOT = process.cwd();
const DEFAULT_APP_PORT = 13000;
const DEFAULT_LOG_PORT = 13011;
const APP_PORT = readEnvPort(process.env, 'SMOKE_APP_PORT', DEFAULT_APP_PORT);
const LOG_PORT = readEnvPort(process.env, 'SMOKE_LOG_PORT', DEFAULT_LOG_PORT);
const BASE_URL = `http://localhost:${String(APP_PORT)}/entropia/`;
const OUTPUT_DIR = path.join(ROOT, 'test-results', 'smoke');
const LOG_DIR = path.join(OUTPUT_DIR, 'log');
const LOG_FILE = path.join(LOG_DIR, 'remote_debug.log');
const SHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const REPORT_PATH = resolveReportPath(ROOT, process.env['SMOKE_REPORT_PATH']);
const BIN = path.join(ROOT, 'node_modules', '.bin');
const CHROMIUM_PATH = process.env['SMOKE_CHROMIUM_PATH'];
const HTTP_OK = 200;
const LOG_SERVER_START_WAIT_MS = 1000;
const REPORT_DATE_LENGTH = 10;
const CONSOLE_SNIPPET_LENGTH = 200;
const WAIT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const SIM_WARMUP_MS = 3000;
const SMOKE_RUNTIME_MS = 30_000;
const WS_TIMEOUT_MS = 5_000;
const RELOAD_WAIT_MS = 6000;
const WORKER_FORWARD_WAIT_MS = 2000;
const PAGE_READY_TIMEOUT_MS = 30_000;
const SETUP_TIMEOUT_MS = 120_000;
const RUNTIME_TEST_TIMEOUT_MS = 60_000;
const REPORT_ERROR_LIMIT = 20;
const LOG_SAMPLE_LINES = 25;
const LOG_LINE_RE = /^\[\d{4}-\d{2}-\d{2}T[^\]]*\] \[(INFO|WARNING|ERROR)\]/;

interface ConsoleRecord { type: string; text: string; }
interface WsRecord { url: string; frameCount: number; }
interface CheckResult { check: string; isPassed: boolean; notes: string; }

const results: CheckResult[] = [];
const consoleRecords: ConsoleRecord[] = [];
const pageErrors: string[] = [];
const wsRecords: WsRecord[] = [];

let logServer: ChildProcess | null = null;
let logServerOut = '';
let viteOut = '';

const record = (check: string, isPassed: boolean, notes = ''): void => {
    results.push({ check, isPassed, notes });
};

// Headless software-rendering and Vite HMR generate environment noise unrelated
// to the log transport; those are filtered out of the "no errors" assertions.
const BENIGN_ERROR_RE = /Error creating WebGL context|WebGL|WebSocket closed without opened|ResizeObserver|Unexpected response code: 400|Failed to load resource: the server responded with a status of 404/i;
const isBenign = (text: string): boolean => BENIGN_ERROR_RE.test(text);
const nonBenignConsoleErrors = (): ConsoleRecord[] => consoleRecords.filter(c => c.type === 'error' && !isBenign(c.text));
const nonBenignPageErrors = (): string[] => pageErrors.filter(e => !isBenign(e));
const nonBenignCount = (): number => nonBenignConsoleErrors().length + nonBenignPageErrors().length;
const errorCount = (): number => consoleRecords.filter(c => c.type === 'error').length;

const sleep = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms); });

const waitForHttp = async (url: string, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.status === HTTP_OK) return true;
        } catch {
            /* not ready yet */
        }
        await sleep(POLL_INTERVAL_MS);
    }
    return false;
};

const readNewLog = (): string => {
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf8');
};

const logLines = (text: string): string[] => text.split('\n').filter(l => LOG_LINE_RE.test(l));

const summarizeErrors = (items: string[]): string => {
    const unique = [...new Set(items)];
    if (unique.length === 0) return '- (none)';
    const shown = unique.slice(0, REPORT_ERROR_LIMIT).map(e => `- ${e}`).join('\n');
    const extra = unique.length > REPORT_ERROR_LIMIT
        ? `\n- ...and ${String(unique.length - REPORT_ERROR_LIMIT)} more unique messages (total ${String(items.length)})`
        : '';
    return shown + extra;
};

const gitCommit = (): string => {
    try {
        // git is resolved from PATH on purpose: it is the developer's own tool and only labels the report.
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- report label only
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
    } catch {
        return 'unknown';
    }
};

const writeReport = (): void => {
    const rows = results.map((r, i) => `| ${String(i + 1)} | ${r.check} | ${r.isPassed ? '✅' : '❌'} | ${r.notes} |`).join('\n');
    const md = `# Smoke Report — Log Transport — ${new Date().toISOString().slice(0, REPORT_DATE_LENGTH)}

## Environment
- App port: ${String(APP_PORT)}
- Log server port: ${String(LOG_PORT)}
- Browser: ${CHROMIUM_PATH ?? 'Playwright-managed Chromium'}
- Commit: ${gitCommit()}

## Results
| # | Check | Status | Notes |
|---|---|---|---|
${rows}

## WebSockets observed
${wsRecords.map(w => `- ${w.url} (frames received: ${String(w.frameCount)})`).join('\n') || '- (none)'}

## Console errors (deduplicated, capped)
${summarizeErrors(consoleRecords.filter(c => c.type === 'error').map(c => c.text))}

## Page errors (deduplicated, capped)
${summarizeErrors(pageErrors)}

## Captured log (sample)
\`\`\`
${readNewLog().split('\n').slice(0, LOG_SAMPLE_LINES).join('\n')}
\`\`\`
`;
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, md);
};

const startLogServer = (): ChildProcess => {
    // Absolute path to a project-local binary, so PATH is never consulted.
     
    const proc = spawnOwned(path.join(BIN, 'tsx'), [path.join(ROOT, 'scripts', 'log-server.ts')], {
        cwd: LOG_DIR,
        env: { ...process.env, LOG_SERVER_PORT: String(LOG_PORT) },
    });
    proc.stdout?.on('data', (chunk: Buffer) => { logServerOut += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { logServerOut += chunk.toString(); });
    return proc;
};

const startVite = (): ChildProcess => {
     
    const proc = spawnOwned(path.join(BIN, 'vite'), ['--port', String(APP_PORT), '--strictPort'], {
        cwd: ROOT,
        env: { ...process.env, VITE_LOG_WS_PORT: String(LOG_PORT) },
    });
    proc.stdout?.on('data', (chunk: Buffer) => { viteOut += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { viteOut += chunk.toString(); });
    return proc;
};

const requireLogServer = (): ChildProcess => {
    if (logServer === null) throw new Error('log server is not running');
    return logServer;
};

const requirePage = (page: Page | undefined): Page => {
    if (page === undefined) throw new Error('browser page was not created in beforeAll');
    return page;
};

test.describe.configure({ mode: 'serial' });

let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;

test.beforeAll(async () => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    // Fail before starting anything if a dedicated port is taken: never free it by killing its owner.
    await assertPortAvailable(APP_PORT);
    await assertPortAvailable(LOG_PORT);

    fs.rmSync(LOG_DIR, { recursive: true, force: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.mkdirSync(SHOT_DIR, { recursive: true });

    logServer = startLogServer();
    await sleep(LOG_SERVER_START_WAIT_MS);

    startVite();

    const isServerReady = await waitForHttp(BASE_URL, WAIT_HTTP_TIMEOUT_MS);
    if (!isServerReady) {
        throw new Error(`Vite did not become ready at ${BASE_URL}.\n${viteOut}\n--- log-server ---\n${logServerOut}`);
    }

    const pw = await import('@playwright/test');
    browser = await pw.chromium.launch(CHROMIUM_PATH !== undefined && CHROMIUM_PATH !== ''
        ? { executablePath: CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'] }
        : { channel: 'chromium', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'] });
    context = await browser.newContext();
    page = await context.newPage();

    page.on('console', (msg: ConsoleMessage) => { consoleRecords.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', (err: Error) => { pageErrors.push(err.message); });
    page.on('websocket', (ws) => {
        const rec: WsRecord = { url: ws.url(), frameCount: 0 };
        wsRecords.push(rec);
        ws.on('framereceived', () => { rec.frameCount += 1; });
    });
});

test.afterAll(async () => {
    try {
        writeReport();
    } catch {
        /* ignore report failures */
    }

    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await stopAllOwned();
    logServer = null;
});

// Last-resort cleanup: a crashed or interrupted run must not leave its servers behind.
process.once('exit', killAllOwnedSync);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
        killAllOwnedSync();
        process.exit(1);
    });
}

test('1. page loads clean', async () => {
    const currentPage = requirePage(page);
    await currentPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await currentPage.waitForSelector('canvas', { timeout: PAGE_READY_TIMEOUT_MS });
    await sleep(SIM_WARMUP_MS);
    const count = nonBenignCount();
    record('page loads clean', count === 0,
        `consoleErrors=${String(errorCount())} (benign filtered), pageErrors=${String(pageErrors.length)} (benign filtered), nonBenign=${String(count)}`);
    expect(count, `non-benign errors: ${nonBenignConsoleErrors().map(c => c.text).concat(nonBenignPageErrors()).join(' | ')}`).toBe(0);
});

test('2. simulation starts', async () => {
    await sleep(SIM_WARMUP_MS);
    await requirePage(page).screenshot({ path: path.join(SHOT_DIR, '01-simulation-started.png') });
    const isBooted = readNewLog().includes('Worker initialized');
    record('simulation starts (worker booted)', isBooted, isBooted ? 'saw "Proxy: Worker initialized"' : 'no boot marker in remote log');
    expect(isBooted, 'worker did not initialize').toBe(true);
});

test('3. WS connected to log port', () => {
    const appWs = wsRecords.filter(w => w.url.includes(`:${String(LOG_PORT)}`));
    record('WS connected', appWs.length > 0, `urls=[${wsRecords.map(w => w.url).join(', ')}]`);
    expect(appWs.length, `no WS to :${String(LOG_PORT)} (saw ${wsRecords.map(w => w.url).join(', ')})`).toBeGreaterThan(0);
});

test('4. runs 30s without new errors', async () => {
    test.setTimeout(RUNTIME_TEST_TIMEOUT_MS);
    const before = nonBenignCount();
    await requirePage(page).waitForTimeout(SMOKE_RUNTIME_MS);
    const after = nonBenignCount();
    record('runs 30s without errors', after === before, `nonBenign before=${String(before)} after=${String(after)}`);
    expect(after).toBe(before);
});

test('5. connection observed (log-server side)', () => {
    const isConnected = logServerOut.includes('[Connected]');
    record('log-server reports connection', isConnected, isConnected ? 'saw [Connected]' : 'no [Connected] in log-server stdout');
    expect(isConnected, 'log-server never logged [Connected]').toBe(true);
});

test('6. remote_debug.log has log entries', () => {
    const lines = logLines(readNewLog());
    record('remote log entries', lines.length > 0, `entries=${String(lines.length)}`);
    expect(lines.length).toBeGreaterThan(0);
});

test('7. worker console forwarded', async () => {
    const workers = requirePage(page).workers();
    record('simulation worker present', workers.length > 0, `workers=${String(workers.length)}`);
    expect(workers.length, 'no web worker found').toBeGreaterThan(0);

    const [worker] = workers;
    if (worker === undefined) throw new Error('unreachable: worker list checked above');
    await worker.evaluate(() => { console.log('smoke-worker-test-msg'); });
    await worker.evaluate(() => {
        (globalThis as { __entropiaSmoke?: { warnViaLogger: (m: string) => void } })
            .__entropiaSmoke?.warnViaLogger('smoke-via-logger');
    });
    await sleep(WORKER_FORWARD_WAIT_MS);

    const text = readNewLog();
    const hasConsole = text.includes('smoke-worker-test-msg');
    const hasLogger = text.includes('smoke-via-logger');
    const hasWorkerSource = text.includes('Worker');
    record('worker console forwarded to remote', hasConsole && hasWorkerSource, `msg=${String(hasConsole)} sourceWorker=${String(hasWorkerSource)}`);
    record('worker logger.* forwarded to remote', hasLogger, `msg=${String(hasLogger)}`);
    expect(hasConsole, 'worker console message not found in remote log').toBe(true);
    expect(hasLogger, 'worker logger.warn not found in remote log').toBe(true);
});

test('8. WS close is logged', async () => {
    const before = consoleRecords.length;
    await stopOwned(requireLogServer());
    await sleep(WS_TIMEOUT_MS);
    const newMsgs = consoleRecords.slice(before).map(c => c.text).join('\n');
    const isClosed = newMsgs.includes('remote log WS closed');
    record('WS close logged', isClosed, isClosed ? 'saw "remote log WS closed"' : `new console: ${newMsgs.slice(0, CONSOLE_SNIPPET_LENGTH)}`);
    expect(isClosed, 'no "remote log WS closed" after stopping the log server').toBe(true);
});

test('9. WS reconnect is logged', async () => {
    const connectionsBefore = (logServerOut.match(/\[Connected\]/g) ?? []).length;
    logServer = startLogServer();
    await sleep(WS_TIMEOUT_MS);
    const connectionsAfter = (logServerOut.match(/\[Connected\]/g) ?? []).length;
    const isReconnected = connectionsAfter > connectionsBefore;
    record('WS reconnect observed', isReconnected, `connections ${String(connectionsBefore)} -> ${String(connectionsAfter)}`);
    expect(isReconnected, 'log-server did not observe a reconnect').toBe(true);
});

test('10. reload does not break', async () => {
    const currentPage = requirePage(page);
    const errorsBefore = nonBenignCount();
    await currentPage.reload({ waitUntil: 'domcontentloaded' });
    await currentPage.waitForSelector('canvas', { timeout: PAGE_READY_TIMEOUT_MS });
    await sleep(RELOAD_WAIT_MS);
    const errorsAdded = nonBenignCount() - errorsBefore;
    record('reload stable', errorsAdded === 0, `new nonBenign errors=${String(errorsAdded)}`);
    expect(errorsAdded, 'non-benign errors appeared after reload').toBe(0);
});
