import type { MemoryStats } from '@/types';

/**
 * Chromium exposes a non-standard estimate of the browser's JavaScript heap.
 * It does not include the simulation worker or GPU resources and may be unavailable.
 */
interface BrowserHeapPerformance extends Performance {
    readonly memory?: {
        readonly usedJSHeapSize: number;
        readonly totalJSHeapSize: number;
        readonly jsHeapSizeLimit: number;
    };
}

export const readBrowserHeapStats = (source: Performance | undefined): MemoryStats | null => {
    const memory = (source as BrowserHeapPerformance | undefined)?.memory;
    if (!memory) return null;

    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = memory;
    if (![usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit].every(Number.isFinite)
        || usedJSHeapSize < 0 || totalJSHeapSize <= 0 || jsHeapSizeLimit <= 0) return null;

    return {
        usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit,
        used: usedJSHeapSize, total: totalJSHeapSize, limit: jsHeapSizeLimit
    };
};
