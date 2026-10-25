import path from 'node:path';

import { expect, test } from '@playwright/test';

import { assertPortAvailable, spawnOwned, stopAllOwned } from '../../scripts/smoke-harness';

const ROOT = process.cwd();
const PORT = 13055;
const BASE_URL = `http://127.0.0.1:${String(PORT)}/entropia/`;
const STARTUP_MS = 45_000;
const CHART_TIMEOUT_MS = 15_000;
const MIN_CURVE_COUNT = 2;
const CAMERA_COORDINATE_COUNT = 3;
const CURVE_SELECTOR = '.recharts-area-curve';

test.beforeAll(async () => {
    await assertPortAvailable(PORT);
    spawnOwned(path.join(ROOT, 'node_modules', '.bin', 'vite'), [
        '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
    ], { cwd: ROOT, env: { ...process.env } });

    await expect.poll(async () => {
        try {
            return (await fetch(BASE_URL)).ok;
        } catch {
            return false;
        }
    }, { timeout: STARTUP_MS }).toBe(true);
});

test.afterAll(async () => { await stopAllOwned(); });

test('the live memory chart renders its curve without an animation clip', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas').first().waitFor();
    const isSupported = await page.evaluate(() => {
        const perf = performance as Performance & {
            memory?: { readonly usedJSHeapSize: number };
        };
        return typeof perf.memory?.usedJSHeapSize === 'number';
    });
    test.skip(!isSupported, 'JS heap readings are unavailable in this browser');

    await page.getByRole('button', { name: /Diagnostics/i }).first().click();
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    const chart = page.locator('.recharts-area').filter({ has: page.locator(CURVE_SELECTOR) });

    await expect.poll(async () => chart.locator(CURVE_SELECTOR).getAttribute('d'), {
        timeout: CHART_TIMEOUT_MS
    }).toMatch(/C/);

    const svg = chart.locator("xpath=ancestor::*[local-name()='svg'][1]");
    await expect(svg).toBeVisible();

    // Live samples change once a second. Recharts' growing-area animation must not hide the path on every update.
    await expect(chart.locator('g[clip-path]')).toHaveCount(0);
    await expect(chart.locator(CURVE_SELECTOR)).toHaveAttribute('stroke', '#8b5cf6');
    await expect(page.getByText('JavaScript Heap Usage Over Time')).toBeVisible();
});

test('performance charts use live canvas samples and world diagnostics use the live camera', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas').first().waitFor();
    await page.getByRole('button', { name: /Diagnostics/i }).first().click();

    // The performance charts must not depend on the simulation worker's optional monitor history.
    await expect.poll(async () => page.locator('.recharts-line-curve').count(), {
        timeout: CHART_TIMEOUT_MS
    }).toBeGreaterThanOrEqual(MIN_CURVE_COUNT);
    await expect.poll(async () => page.locator(CURVE_SELECTOR).count(), {
        timeout: CHART_TIMEOUT_MS
    }).toBeGreaterThanOrEqual(1);
    await expect(page.getByText('FPS/TPS Dynamics')).toBeVisible();

    await page.getByRole('button', { name: 'World', exact: true }).click();
    await expect(page.getByText('600×600×600')).toBeVisible();
    const world = page.locator('body');

    await expect.poll(async () => {
        const content = await world.innerText();
        const position = /CAMERA POSITION\s*\(([^)]+)\)/.exec(content);
        const distance = /Distance:\s*(\d+)/.exec(content);
        const coordinates = position?.[1]?.split(',').map(Number) ?? [];
        return coordinates.length === CAMERA_COORDINATE_COUNT
            && coordinates.some(value => Number.isFinite(value) && value !== 0)
            && Number(distance?.[1]) > 0;
    }, { timeout: CHART_TIMEOUT_MS }).toBe(true);

    await expect(page.getByText('Mean entities/cell (approx.):')).toBeVisible();
    await expect(page.getByText('Max. entities/cell:')).toBeVisible();
});
