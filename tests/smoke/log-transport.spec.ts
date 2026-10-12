import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type ConsoleMessage, type Page } from '@playwright/test';

const ROOT = process.cwd();
const APP_PORT = 13000;
const LOG_PORT = 13011;
const BASE_URL = `http://localhost:${APP_PORT}/entropia/`;
const LOG_DIR = '/tmp/opencode/log-smoke';
const LOG_FILE = path.join(LOG_DIR, 'remote_debug.log');
const SHOT_DIR = path.join(ROOT, 'docs/cycles/logger-payloads/screenshots');
const REPORT_PATH = path.join(ROOT, 'docs/cycles/logger-payloads/smoke-report.md');
const BIN = path.join(ROOT, 'node_modules/.bin');
const PW_VERSION = ((): string => {
    try {
        const pkg = path.join(ROOT, 'node_modules/@playwright/test/package.json');
        return (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { version: string }).version;
    } catch {
        return 'unknown';
    }
})();
const HTTP_OK = 200;
const WAIT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const SIM_WARMUP_MS = 3000;
const SMOKE_RUNTIME_MS = 30_000;
const WS_TIMEOUT_MS = 5_000;
const WS_CLOSE_WAIT_MS = WS_TIMEOUT_MS;
const WS_RECONNECT_WAIT_MS = WS_TIMEOUT_MS;
const RELOAD_WAIT_MS = 6000;
const WORKER_FORWARD_WAIT_MS = 2000;

interface ConsoleRecord { type: string; text: string; }
interface WsRecord { url: string; frameCount: number; }

const results: { check: string; status: string; notes: string }[] = [];
const consoleRecords: ConsoleRecord[] = [];
const pageErrors: string[] = [];
const wsRecords: WsRecord[] = [];

let logServer: ChildProcess | null = null;
let vite: ChildProcess | null = null;
let logServerOut = '';
let viteOut = '';

const record = (check: string, ok: boolean, notes = ''): void => {
    results.push({ check, status: ok ? 'PASS' : 'FAIL', notes });
};

// Headless software-rendering and Vite HMR generate environment noise unrelated
// to the log transport; those are filtered out of the "no errors" assertions.
const BENIGN_ERROR_RE = /Error creating WebGL context|WebGL|WebSocket closed without opened|ResizeObserver|Unexpected response code: 400|Failed to load resource: the server responded with a status of 404/i;
const isBenign = (text: string): boolean => BENIGN_ERROR_RE.test(text);
const nonBenignConsoleErrors = (): ConsoleRecord[] => consoleRecords.filter(c => c.type === 'error' && !isBenign(c.text));
const nonBenignPageErrors = (): string[] => pageErrors.filter(e => !isBenign(e));

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

const appendLogServer = (chunk: Buffer): void => { logServerOut += chunk.toString(); };
const appendVite = (chunk: Buffer): void => { viteOut += chunk.toString(); };

const startLogServer = (): ChildProcess => {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const proc = spawn(path.join(BIN, 'tsx'), [path.join(ROOT, 'scripts/log-server.ts')], {
        cwd: LOG_DIR,
        env: { ...process.env, LOG_SERVER_PORT: String(LOG_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout?.on('data', appendLogServer);
    proc.stderr?.on('data', appendLogServer);
    return proc;
};

const killPort = (port: number): void => {
    try {
        execSync(`lsof -ti:${port} | xargs -r kill`, { stdio: 'ignore' });
    } catch {
        /* nothing on the port */
    }
};

const readNewLog = (): string => {
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf8');
};

const LOG_LINE_RE = /^\[\d{4}-\d{2}-\d{2}T[^\]]*\] \[(INFO|WARNING|ERROR)\]/;
const logLines = (text: string): string[] => text.split('\n').filter(l => LOG_LINE_RE.test(l));

const REPORT_ERROR_LIMIT = 20;
const summarizeErrors = (items: string[]): string => {
    const unique = [...new Set(items)];
    if (unique.length === 0) return '- (none)';
    const shown = unique.slice(0, REPORT_ERROR_LIMIT).map(e => `- ${e}`).join('\n');
    const extra = unique.length > REPORT_ERROR_LIMIT
        ? `\n- ...and ${String(unique.length - REPORT_ERROR_LIMIT)} more unique messages (total ${String(items.length)})`
        : '';
    return shown + extra;
};

const writeReport = (appPort: number, logPort: number, commit: string): void => {
    const rows = results.map((r, i) => `| ${String(i + 1)} | ${r.check} | ${r.status === 'PASS' ? '✅' : '❌'} | ${r.notes} |`).join('\n');
    const md = `# Smoke Report — Log Transport — ${new Date().toISOString().slice(0, 10)}

## Environment
- App port: ${String(appPort)}
- Log server port: ${String(logPort)}
- Browser: Chromium (Playwright ${PW_VERSION})
- Commit: ${commit}

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
${readNewLog().split('\n').slice(0, 25).join('\n')}
\`\`\`
`;
    fs.writeFileSync(REPORT_PATH, md);
};

test.describe.configure({ mode: 'serial' });

let browser: Browser;
let context: BrowserContext;
let page: Page;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    killPort(LOG_PORT);
    killPort(APP_PORT);
    fs.rmSync(LOG_FILE, { force: true });

    logServer = startLogServer();
    await sleep(1000);

    vite = spawn(path.join(BIN, 'vite'), ['--port', String(APP_PORT), '--strictPort'], {
        cwd: ROOT,
        env: { ...process.env, VITE_LOG_WS_PORT: String(LOG_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    vite.stdout?.on('data', appendVite);
    vite.stderr?.on('data', appendVite);

    const ready = await waitForHttp(BASE_URL, WAIT_HTTP_TIMEOUT_MS);
    if (!ready) {
        throw new Error(`Vite did not become ready at ${BASE_URL}.\n${viteOut}\n--- log-server ---\n${logServerOut}`);
    }

    const pw = await import('@playwright/test');
    browser = await pw.chromium.launch({
        channel: 'chromium',
        args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
    });
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
        const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
        writeReport(APP_PORT, LOG_PORT, commit);
    } catch {
        /* ignore report failures */
    }

    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    killPort(APP_PORT);
    killPort(LOG_PORT);
    logServer = null;
    vite = null;
});

test('1. page loads clean', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 30_000 });
    await sleep(SIM_WARMUP_MS);
    const nonBenign = nonBenignConsoleErrors().length + nonBenignPageErrors().length;
    record('page loads clean', nonBenign === 0,
        `consoleErrors=${String(consoleRecords.filter(c => c.type === 'error').length)} (benign filtered), pageErrors=${String(pageErrors.length)} (benign filtered), nonBenign=${String(nonBenign)}`);
    expect(nonBenign, `non-benign errors: ${nonBenignConsoleErrors().map(c => c.text).concat(nonBenignPageErrors()).join(' | ')}`).toBe(0);
});

test('2. simulation starts', async () => {
    await sleep(SIM_WARMUP_MS);
    await page.screenshot({ path: path.join(SHOT_DIR, '01-simulation-started.png') });
    const booted = readNewLog().includes('Worker initialized');
    record('simulation starts (worker booted)', booted, booted ? 'saw "Proxy: Worker initialized"' : 'no boot marker in remote log');
    expect(booted, 'worker did not initialize').toBe(true);
});

test('3. WS connected to log port', async () => {
    const appWs = wsRecords.filter(w => w.url.includes(`:${String(LOG_PORT)}`));
    record('WS connected', appWs.length > 0, `urls=[${wsRecords.map(w => w.url).join(', ')}]`);
    expect(appWs.length, `no WS to :${String(LOG_PORT)} (saw ${wsRecords.map(w => w.url).join(', ')})`).toBeGreaterThan(0);
});

test('4. runs 30s without new errors', async () => {
    test.setTimeout(60_000);
    const before = nonBenignConsoleErrors().length + nonBenignPageErrors().length;
    await page.waitForTimeout(SMOKE_RUNTIME_MS);
    const after = nonBenignConsoleErrors().length + nonBenignPageErrors().length;
    record('runs 30s without errors', after === before, `nonBenign before=${String(before)} after=${String(after)}`);
    expect(after).toBe(before);
});

test('5. connection observed (log-server side)', async () => {
    const connected = logServerOut.includes('[Connected]');
    record('log-server reports connection', connected, connected ? 'saw [Connected]' : 'no [Connected] in log-server stdout');
    expect(connected, 'log-server never logged [Connected]').toBe(true);
});

test('6. remote_debug.log has log entries', async () => {
    const lines = logLines(readNewLog());
    record('remote log entries', lines.length > 0, `entries=${String(lines.length)}`);
    expect(lines.length).toBeGreaterThan(0);
});

test('7. worker console forwarded', async () => {
    const workers = page.workers();
    record('simulation worker present', workers.length > 0, `workers=${String(workers.length)}`);
    expect(workers.length, 'no web worker found').toBeGreaterThan(0);

    await workers[0]!.evaluate(() => { console.log('smoke-worker-test-msg'); });
    await sleep(WORKER_FORWARD_WAIT_MS);

    const text = readNewLog();
    const hasMsg = text.includes('smoke-worker-test-msg');
    const hasWorkerSource = text.includes('Worker');
    record('worker console forwarded to remote', hasMsg && hasWorkerSource, `msg=${String(hasMsg)} sourceWorker=${String(hasWorkerSource)}`);
    expect(hasMsg, 'worker console message not found in remote log').toBe(true);
});

test('8. WS close is logged', async () => {
    const before = consoleRecords.length;
    killPort(LOG_PORT);
    await sleep(WS_CLOSE_WAIT_MS);
    const newMsgs = consoleRecords.slice(before).map(c => c.text).join('\n');
    const closed = newMsgs.includes('remote log WS closed');
    record('WS close logged', closed, closed ? 'saw "remote log WS closed"' : `new console: ${newMsgs.slice(0, 200)}`);
    expect(closed, 'no "remote log WS closed" after killing server').toBe(true);
});

test('9. WS reconnect is logged', async () => {
    const connectionsBefore = (logServerOut.match(/\[Connected\]/g) ?? []).length;
    logServer = startLogServer();
    await sleep(WS_RECONNECT_WAIT_MS);
    const connectionsAfter = (logServerOut.match(/\[Connected\]/g) ?? []).length;
    const reconnected = connectionsAfter > connectionsBefore;
    record('WS reconnect observed', reconnected, `connections ${String(connectionsBefore)} -> ${String(connectionsAfter)}`);
    expect(reconnected, 'log-server did not observe a reconnect').toBe(true);
});

test('10. reload does not break', async () => {
    const errorsBefore = nonBenignConsoleErrors().length + nonBenignPageErrors().length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 30_000 });
    await sleep(RELOAD_WAIT_MS);
    const errorsAdded = nonBenignConsoleErrors().length + nonBenignPageErrors().length - errorsBefore;
    record('reload stable', errorsAdded === 0, `new nonBenign errors=${String(errorsAdded)}`);
    expect(errorsAdded, 'non-benign errors appeared after reload').toBe(0);
});
