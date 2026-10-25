/* eslint-disable @typescript-eslint/no-magic-numbers */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INITIAL_SIMULATION_STATS } from '@/config';
import type { MemoryStats, SystemMetrics } from '@/types';

import { useSystemMetrics } from '../hooks';

const makeMemory = (bytes: number): MemoryStats => ({
    usedJSHeapSize: bytes, totalJSHeapSize: bytes * 2, jsHeapSizeLimit: bytes * 10,
    used: bytes, total: bytes * 2, limit: bytes * 10
});

let received: SystemMetrics[] = [];
let sample = makeMemory(1000);

const MetricsHarness = ({ isOpen, available }: { isOpen: boolean; available: boolean }) => {
    const metrics = useSystemMetrics({
        isOpen,
        performanceHistory: [],
        memoryStats: available ? sample : null,
        currentStats: { ...INITIAL_SIMULATION_STATS }
    });
    useEffect(() => { received = metrics; });
    return null;
};

describe('memory diagnostics sampling', () => {
    let root: Root;
    let host: HTMLDivElement;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        vi.useFakeTimers();
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        received = [];
        sample = makeMemory(1000);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        host.remove();
        vi.useRealTimers();
    });

    it('keeps collecting a history while the parent rapidly re-renders with new stats', () => {
        act(() => { root.render(<MetricsHarness isOpen available />); });

        for (let i = 0; i < 30; i++) {
            sample = makeMemory(1000 + i);
            act(() => {
                root.render(<MetricsHarness isOpen available />);
                vi.advanceTimersByTime(100);
            });
        }

        expect(received.length).toBeGreaterThanOrEqual(2);
        expect(received.at(-1)?.memory).toBeGreaterThan(1000);
    });

    it('continues collecting performance frames if the memory API is unavailable', () => {
        act(() => { root.render(<MetricsHarness isOpen available={false} />); });
        act(() => { vi.advanceTimersByTime(3000); });
        expect(received.length).toBeGreaterThanOrEqual(2);
        expect(received.at(-1)?.fps).toBe(INITIAL_SIMULATION_STATS.performance.fps);
    });
});
