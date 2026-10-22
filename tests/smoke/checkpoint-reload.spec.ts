import path from 'node:path';

import { type Browser, chromium, expect, type Page, test } from '@playwright/test';

import {
    assertPortAvailable,
    killAllOwnedSync,
    readEnvPort,
    spawnOwned,
    stopAllOwned,
} from '../../scripts/smoke-harness';

// A world saved by a pause must survive a page reload and resume at the tick it was saved at. The browser store is the
// only thing carried across the reload, so this checks the real IndexedDB path rather than the engine alone.
const ROOT = process.cwd();
const DEFAULT_APP_PORT = 13020;
const APP_PORT = readEnvPort(process.env, 'SMOKE_CHECKPOINT_PORT', DEFAULT_APP_PORT);
const BASE_URL = `http://localhost:${String(APP_PORT)}/entropia/`;
const BIN = path.join(ROOT, 'node_modules', '.bin');
const CHROMIUM_PATH = process.env['SMOKE_CHROMIUM_PATH'];
const WAIT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const SETUP_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 90_000;
const RUN_BEFORE_PAUSE_MS = 3_000;
const SAVED_TICK_PATTERN = /^Saved at tick (\d+)$/;
const PANEL_NAME = 'Saved world';
const RESUME_LABEL = 'Resume saved world';

let browser: Browser | null = null;

const waitForHttp = async (url: string): Promise<void> => {
    const deadline = Date.now() + WAIT_HTTP_TIMEOUT_MS;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // The dev server is still starting.
        }
        await new Promise(resolve => { setTimeout(resolve, POLL_INTERVAL_MS); });
    }
    throw new Error(`no response from ${url} within ${String(WAIT_HTTP_TIMEOUT_MS)} ms`);
};

const savedTickOf = (text: string): number => {
    const match = SAVED_TICK_PATTERN.exec(text);
    if (!match?.[1]) throw new Error(`the status does not report a saved tick: "${text}"`);
    return Number(match[1]);
};

test.beforeAll(async () => {
    test.setTimeout(SETUP_TIMEOUT_MS);
    await assertPortAvailable(APP_PORT);
    // The harness stops this process at the end of the run, so no reference is kept.
    spawnOwned(path.join(BIN, 'vite'), ['--port', String(APP_PORT), '--strictPort'], { cwd: ROOT, env: { ...process.env } });
    await waitForHttp(BASE_URL);
    browser = await chromium.launch(CHROMIUM_PATH !== undefined && CHROMIUM_PATH !== ''
        ? { executablePath: CHROMIUM_PATH, args: ['--disable-gpu', '--disable-dev-shm-usage'] }
        : { channel: 'chromium', args: ['--disable-gpu', '--disable-dev-shm-usage'] });
});

test.afterAll(async () => {
    await browser?.close();
    await stopAllOwned();
});

process.once('exit', killAllOwnedSync);

test('a paused world is saved, survives a reload, and resumes at the saved tick', async () => {
    test.setTimeout(TEST_TIMEOUT_MS);
    if (!browser) throw new Error('the browser was not started in beforeAll');
    const context = await browser.newContext();
    const page: Page = await context.newPage();
    try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const panel = page.getByRole('region', { name: PANEL_NAME });
        const statusLine = panel.getByRole('status');
        await expect(statusLine).toHaveText('Nothing saved yet');

        await page.waitForTimeout(RUN_BEFORE_PAUSE_MS);
        await page.getByRole('button', { name: /Pause/ }).first().click();
        await expect(statusLine).toHaveText(SAVED_TICK_PATTERN);
        const savedTick = savedTickOf((await statusLine.textContent()) ?? '');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(statusLine).toHaveText(`A saved world is available from tick ${String(savedTick)}`);

        await panel.getByRole('button', { name: RESUME_LABEL }).click();
        await expect(statusLine).toHaveText(`Restored to tick ${String(savedTick)}`);
    } finally {
        await context.close();
    }
});
