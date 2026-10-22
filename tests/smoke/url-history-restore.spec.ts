import path from 'node:path';

import { type Browser, chromium, expect, type Locator, type Page, test } from '@playwright/test';

import {
    assertPortAvailable,
    killAllOwnedSync,
    readEnvPort,
    spawnOwned,
    stopAllOwned,
} from '../../scripts/smoke-harness';

// Back and Forward must not undo a checkpoint restore. The page is opened with a link that names a food limit, a setting
// is changed, the saved world is restored, and then the history buttons are used. Only the setting the history step
// changes may move, and the restored food limit must stay.
const ROOT = process.cwd();
const DEFAULT_APP_PORT = 13030;
const APP_PORT = readEnvPort(process.env, 'SMOKE_URL_HISTORY_PORT', DEFAULT_APP_PORT);
const BASE_URL = `http://localhost:${String(APP_PORT)}/entropia/`;
const BIN = path.join(ROOT, 'node_modules', '.bin');
const CHROMIUM_PATH = process.env['SMOKE_CHROMIUM_PATH'];
const WAIT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const SETUP_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 120_000;
const RUN_BEFORE_PAUSE_MS = 3_000;
const LINKED_MAX_FOOD = '1500';
const PANEL_NAME = 'Saved world';
const RESUME_LABEL = 'Resume saved world';
const SAVED_TICK_PATTERN = /^Saved at tick \d+$/;
const RECOVERY_PATTERN = /^A saved world is available from tick \d+$/;
const RESTORED_PATTERN = /^Restored to tick \d+$/;

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

// The panel's status line, and the food limit slider and the trails switch of the settings panel.
const statusOf = (page: Page): Locator => page.getByRole('region', { name: PANEL_NAME }).getByRole('status');
const resourcesInput = (page: Page): Locator => page.getByText('Resources', { exact: true }).locator('xpath=../..').locator('input[type="range"]');
const trailsSwitch = (page: Page): Locator => page.getByText('Trails', { exact: true }).locator('xpath=../..').getByRole('button');

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

test('Back and Forward keep the food limit that a checkpoint restore brought back', async () => {
    test.setTimeout(TEST_TIMEOUT_MS);
    if (!browser) throw new Error('the browser was not started in beforeAll');
    const context = await browser.newContext();
    try {
        // A checkpoint of the default world, saved by a pause in the first page.
        const first: Page = await context.newPage();
        await first.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await first.waitForTimeout(RUN_BEFORE_PAUSE_MS);
        await first.getByRole('button', { name: /Pause/ }).first().click();
        await expect(statusOf(first)).toHaveText(SAVED_TICK_PATTERN);
        const defaultMaxFood = await resourcesInput(first).inputValue();
        expect(defaultMaxFood).not.toBe(LINKED_MAX_FOOD);
        await first.close();

        // A link to the same world with another food limit. The saved world is offered for recovery.
        const second: Page = await context.newPage();
        await second.goto(`${BASE_URL}?maxFood=${LINKED_MAX_FOOD}`, { waitUntil: 'domcontentloaded' });
        await expect(statusOf(second)).toHaveText(RECOVERY_PATTERN);
        await expect(resourcesInput(second)).toHaveValue(LINKED_MAX_FOOD);

        // A discrete change adds a page to the history. The page is written from the linked world, so it keeps the limit.
        await trailsSwitch(second).click();
        await expect(second).toHaveURL(/showTrails=false/);

        // The restore replaces the linked world with the saved one. The address bar still names the linked limit.
        await second.getByRole('button', { name: RESUME_LABEL }).click();
        await expect(statusOf(second)).toHaveText(RESTORED_PATTERN);
        await expect(resourcesInput(second)).toHaveValue(defaultMaxFood);

        // Back goes to the linked page, which names the same limit as the page the restore left. The restored limit stays.
        await second.goBack();
        await expect(second).toHaveURL(/maxFood=1500/);
        await expect(resourcesInput(second)).toHaveValue(defaultMaxFood);

        await second.goForward();
        await expect(second).toHaveURL(/showTrails=false/);
        await expect(resourcesInput(second)).toHaveValue(defaultMaxFood);
    } finally {
        await context.close();
    }
});
