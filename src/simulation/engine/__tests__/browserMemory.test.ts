import { describe, expect, it } from 'vitest';

import { readBrowserHeapStats } from '../browserMemory';

const stubPerformance = (memory?: Record<string, number>): Performance =>
    ({ memory }) as unknown as Performance;

describe('browser JavaScript heap diagnostics', () => {
    it('reports actual heap measurements when available', () => {
        const stats = readBrowserHeapStats(stubPerformance({
            usedJSHeapSize: 10_000_000,
            totalJSHeapSize: 13_000_000,
            jsHeapSizeLimit: 4_000_000_000
        }));

        expect(stats).toEqual({
            usedJSHeapSize: 10_000_000, totalJSHeapSize: 13_000_000, jsHeapSizeLimit: 4_000_000_000,
            used: 10_000_000, total: 13_000_000, limit: 4_000_000_000
        });
    });

    it('does not fabricate zero-byte measurements when unsupported', () => {
        expect(readBrowserHeapStats(undefined)).toBeNull();
        expect(readBrowserHeapStats(stubPerformance())).toBeNull();
    });

    it('rejects invalid measurements instead of presenting them as actual data', () => {
        expect(readBrowserHeapStats(stubPerformance({
            usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0
        }))).toBeNull();
        expect(readBrowserHeapStats(stubPerformance({
            usedJSHeapSize: Number.NaN, totalJSHeapSize: 10, jsHeapSizeLimit: 100
        }))).toBeNull();
    });
});
