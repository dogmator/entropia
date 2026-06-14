import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from '../Logger';
import { LogLevel } from '../types';

const TEST_MAX_LOGS = 5;
const TEST_ITERATIONS = 7;
const DEFAULT_MAX_LOGS = 1000;
const SLOW_DURATION = 250;
const FAST_DURATION = 16;
const BASE_TIME = 2_000_000;
const NEXT_TICK_TIME = 2_000_001;
const INVALID_MINUTES = -10;

describe('logger/Logger academic refactor', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = Logger.getInstance();
        logger.clear();
        logger.setRemoteLogging(false);
        logger.setMaxLogs(DEFAULT_MAX_LOGS);
    });

    it('deduplicates identical sequential entries', () => {
        logger.warning('same', 'Unit', { value: 1 });
        logger.warning('same', 'Unit', { value: 1 });

        expect(logger.getLogs()).toHaveLength(1);
    });

    it('clamps max logs and keeps stats consistent after cleanup', () => {
        logger.setMaxLogs(TEST_MAX_LOGS);

        for (let index = 0; index < TEST_ITERATIONS; index += 1) {
            logger.info(`entry-${String(index)}`, 'Stats');
        }

        const logs = logger.getLogs();
        const stats = logger.getLogStats();

        expect(logs.length).toBeLessThanOrEqual(TEST_MAX_LOGS);
        expect(stats.total).toBe(logs.length);
        expect(stats.info + stats.warning + stats.error).toBe(stats.total);
    });

    it('falls back to default minutes for invalid recent-log input', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(BASE_TIME);
        logger.info('valid', 'Recent');

        nowSpy.mockReturnValueOnce(NEXT_TICK_TIME);
        const recent = logger.getRecentLogs(INVALID_MINUTES);

        expect(recent).toHaveLength(1);
        nowSpy.mockRestore();
    });


    it('deduplicates payloads with circular data safely', () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;

        logger.warning('circular', 'Unit', circular);
        logger.warning('circular', 'Unit', circular);

        expect(logger.getLogsByLevel(LogLevel.WARNING)).toHaveLength(1);
    });

    it('marks slow performance entries as warning', () => {
        logger.logPerformance('slow-step', SLOW_DURATION, 'Perf');
        logger.logPerformance('fast-step', FAST_DURATION, 'Perf');

        const warnings = logger.getLogs().filter(entry => entry.level === LogLevel.WARNING);

        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.message).toContain('slow-step');
    });
});
