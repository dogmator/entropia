/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportOutcomeUnknownError } from '@/core';
import type { SerializedSimulationStateV1 } from '@/types';

import { EngineProxy } from '../engine/EngineProxy';
import {
    ASYNC_COMMAND_TIMEOUT_MS,
    bridgeProxyToWorker,
    isAnswerTo,
    settle,
    type WorkerBridge,
} from './workerBridgeTestUtils';

const CONFIG_BATCH_DEBOUNCE_MS = 32;
const RESTORED_MAX_FOOD = 123;
const RESTORED_ORGANISMS_DELTA = 7;
const CHANGED_MAX_FOOD = 333;
const DIVERGED_MAX_FOOD = 999;

describe('settings changed around an import', () => {
    let proxy: EngineProxy;
    let bridge: WorkerBridge;

    // The live world with two settings changed, so a stale value of either one would show.
    const withRestoredSettings = (live: SerializedSimulationStateV1): SerializedSimulationStateV1 => ({
        ...live,
        config: { ...live.config, maxFood: RESTORED_MAX_FOOD, maxOrganisms: live.config.maxOrganisms + RESTORED_ORGANISMS_DELTA },
    });

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        proxy = new EngineProxy();
        bridge = await bridgeProxyToWorker(proxy);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('a change made while the import is in flight is applied on top of the restored world, and the proxy agrees with the worker', async () => {
        const restored = withRestoredSettings(await proxy.exportState());

        const pending = proxy.importState(restored);
        // The settings panel sends only the setting it changed.
        proxy.updateConfig({ maxFood: CHANGED_MAX_FOOD });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);
        await pending;

        const world = await proxy.exportState();
        expect(world.config).toMatchObject({ maxFood: CHANGED_MAX_FOOD, maxOrganisms: restored.config.maxOrganisms });
        expect(proxy.config).toEqual(world.config);
    });

    it('a change made after an import nobody could confirm leaves the restored settings it does not touch alone', async () => {
        const restored = withRestoredSettings(await proxy.exportState());
        bridge.loseAnswer = (answer) => isAnswerTo('commitImport')(answer) || isAnswerTo('probeImport')(answer);

        const pending = proxy.importState(restored);
        const assertion = expect(pending).rejects.toBeInstanceOf(ImportOutcomeUnknownError);
        await settle();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
        await settle();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
        await assertion;

        proxy.updateConfig({ maxFood: DIVERGED_MAX_FOOD });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);

        const world = await proxy.exportState();
        expect(world.config).toMatchObject({ maxFood: DIVERGED_MAX_FOOD, maxOrganisms: restored.config.maxOrganisms });
    });

    it('a setting set during the import to the value it had before, such as a preset, is set after the restore too', async () => {
        const before = proxy.config.maxFood;
        expect(before).not.toBe(RESTORED_MAX_FOOD);
        const restored = withRestoredSettings(await proxy.exportState());

        const pending = proxy.importState(restored);
        proxy.updateConfig({ maxFood: before });
        await pending;

        expect((await proxy.exportState()).config.maxFood).toBe(before);
        expect(proxy.config.maxFood).toBe(before);
    });
});
