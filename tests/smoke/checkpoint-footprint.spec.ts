import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { type Browser, chromium, expect, type Page, test } from '@playwright/test';

import {
    assertPortAvailable,
    killAllOwnedSync,
    readEnvPort,
    spawnOwned,
    stopAllOwned,
} from '../../scripts/smoke-harness';

// Measures what the checkpoint store holds in Chromium for the default world at increasing ticks: the stored records, their
// sizes and the storage the browser reports for the origin. Only the default world is measured here, because the resource
// stock has no switch in the UI. The run is slow, so it is off unless STORAGE_REPORT=1. STORAGE_REPORT_PATH sets the output.
const ROOT = process.cwd();
const DEFAULT_APP_PORT = 13021;
const APP_PORT = readEnvPort(process.env, 'SMOKE_FOOTPRINT_PORT', DEFAULT_APP_PORT);
const BASE_URL = `http://localhost:${String(APP_PORT)}/entropia/`;
const BIN = path.join(ROOT, 'node_modules', '.bin');
const CHROMIUM_PATH = process.env['SMOKE_CHROMIUM_PATH'];
const REPORT_PATH = process.env['STORAGE_REPORT_PATH'] ?? path.join(ROOT, 'storage-report.json');
const WAIT_HTTP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const SETUP_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 480_000;
const FIRST_RUN_MS = 5_000;
const SECOND_RUN_MS = 15_000;
const THIRD_RUN_MS = 30_000;
const RUN_SEGMENTS_MS = [FIRST_RUN_MS, SECOND_RUN_MS, THIRD_RUN_MS];
const PAUSE_SETTLE_MS = 1_500;
const MS_PER_SECOND = 1_000;
const JSON_INDENT = 2;
const PANEL_NAME = 'Saved world';
const CHECKPOINT_DB_NAME = 'entropia-checkpoints';
const CHECKPOINT_STORE_NAME = 'checkpoints';

interface StoredRecordSize {
    readonly tick: number;
    readonly characters: number;
    readonly utf8Bytes: number;
}

interface StoreReading {
    readonly records: StoredRecordSize[];
    readonly usageBytes: number;
    readonly quotaBytes: number;
}

interface FootprintRow extends StoreReading {
    readonly tick: number;
    readonly wallMs: number;
    readonly ticksPerSecond: number;
}

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

// Runs in the page. It opens the checkpoint database of the origin, reads its records and asks the browser for usage.
const readStoreInPage = async ({ db, store }: { db: string; store: string }): Promise<StoreReading> => {
    const openDatabase = (name: string): Promise<IDBDatabase> => new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => { resolve(request.result); };
        request.onerror = () => { reject(new Error('could not open the checkpoint database')); };
    });
    const database = await openDatabase(db);
    const records = await new Promise<{ tick: number; payload: string }[]>((resolve, reject) => {
        const request = database.transaction(store, 'readonly').objectStore(store).getAll();
        request.onsuccess = () => { resolve(request.result as { tick: number; payload: string }[]); };
        request.onerror = () => { reject(new Error('could not read the checkpoints')); };
    });
    database.close();
    const encoder = new TextEncoder();
    const estimate = await navigator.storage.estimate();
    return {
        records: records.map(record => ({
            tick: record.tick,
            characters: record.payload.length,
            utf8Bytes: encoder.encode(record.payload).byteLength,
        })),
        usageBytes: estimate.usage ?? 0,
        quotaBytes: estimate.quota ?? 0,
    };
};

const readStore = (page: Page): Promise<StoreReading> =>
    page.evaluate(readStoreInPage, { db: CHECKPOINT_DB_NAME, store: CHECKPOINT_STORE_NAME });

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

test.skip(process.env['STORAGE_REPORT'] !== '1', 'set STORAGE_REPORT=1 to measure the checkpoint footprint in Chromium');

test('the checkpoint store footprint of the default world, at increasing ticks', async () => {
    test.setTimeout(TEST_TIMEOUT_MS);
    if (!browser) throw new Error('the browser was not started in beforeAll');
    const context = await browser.newContext();
    const page: Page = await context.newPage();
    const rows: FootprintRow[] = [];
    try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const panel = page.getByRole('region', { name: PANEL_NAME });
        const statusLine = panel.getByRole('status');
        await expect(statusLine).toHaveText('Nothing saved yet');

        let previousTick = 0;
        for (const runMs of RUN_SEGMENTS_MS) {
            const segmentStarted = Date.now();
            await page.waitForTimeout(runMs);
            await page.getByRole('button', { name: /Pause/ }).first().click();
            const wallMs = Date.now() - segmentStarted;
            await page.waitForTimeout(PAUSE_SETTLE_MS);

            const reading = await readStore(page);
            const newest = reading.records.reduce<StoredRecordSize | null>(
                (latest, record) => (latest === null || record.tick > latest.tick ? record : latest),
                null,
            );
            if (newest === null) throw new Error('the pause did not leave a checkpoint in the store');
            rows.push({
                ...reading,
                tick: newest.tick,
                wallMs,
                ticksPerSecond: (newest.tick - previousTick) / (wallMs / MS_PER_SECOND),
            });
            previousTick = newest.tick;

            await page.getByRole('button', { name: /▶ Run/ }).first().click();
        }

        writeFileSync(REPORT_PATH, `${JSON.stringify(rows, null, JSON_INDENT)}\n`);
        expect(rows).toHaveLength(RUN_SEGMENTS_MS.length);
    } finally {
        await context.close();
    }
});
