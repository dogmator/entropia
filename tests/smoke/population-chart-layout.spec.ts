import path from 'node:path';

import { expect, test } from '@playwright/test';

import { assertPortAvailable, spawnOwned, stopAllOwned } from '../../scripts/smoke-harness';
import { UI_CONFIG } from '../../src/config/ui.constants';

const ROOT = process.cwd();
const PORT = 13057;
const BASE_URL = `http://127.0.0.1:${String(PORT)}/entropia/`;
const STARTUP_MS = 45_000;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Representative mobile, tablet and desktop widths.
const VIEWPORT_WIDTHS = [390, 768, 1024, 1440];
const CHART_SIZE_WARNING = 'of chart should be greater than 0';

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

test('population chart avoids invalid dimensions at startup and after reopening the sidebar', async ({ browser }) => {
    for (const width of VIEWPORT_WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 820 } });
        const warnings: string[] = [];
        page.on('console', message => {
            if (message.text().includes(CHART_SIZE_WARNING)) warnings.push(message.text());
        });

        try {
            await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
            await page.locator('canvas').first().waitFor();

            if (width < UI_CONFIG.breakpoints.mobile) {
                await page.getByRole('button', { name: 'Expand control panel' }).click();
            }

            const chart = page.locator('.recharts-responsive-container').first();
            await expect(chart).toBeVisible();
            await expect.poll(async () => chart.evaluate(element => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            })).toBe(true);

            await page.getByRole('button', { name: 'Collapse control panel' }).first().click();
            await page.getByRole('button', { name: 'Expand control panel' }).click();
            await expect(chart).toBeVisible();
            await expect.poll(async () => chart.evaluate(element => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            })).toBe(true);

            expect(warnings, `viewport ${String(width)}px`).toEqual([]);
        } finally {
            await page.close();
        }
    }
});
