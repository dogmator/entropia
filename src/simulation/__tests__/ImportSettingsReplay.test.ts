/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportOutcomeUnknownError } from '@/core';
import type { SerializedSimulationStateV1, SimulationConfig } from '@/types';

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
        const panel: SimulationConfig = { ...proxy.config };

        const pending = proxy.importState(restored);
        // The panel sends its whole configuration, which still holds the values from before the restore.
        proxy.updateConfig({ ...panel, maxFood: CHANGED_MAX_FOOD });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);
        await pending;

        const world = await proxy.exportState();
        expect(world.config).toMatchObject({ maxFood: CHANGED_MAX_FOOD, maxOrganisms: restored.config.maxOrganisms });
        expect(proxy.config).toEqual(world.config);
    });

    it('a stale panel that changes one setting does not overwrite the restored settings it did not change', async () => {
        const restored = withRestoredSettings(await proxy.exportState());
        const panel: SimulationConfig = { ...proxy.config };
        bridge.loseAnswer = (answer) => isAnswerTo('commitImport')(answer) || isAnswerTo('probeImport')(answer);

        const pending = proxy.importState(restored);
        const assertion = expect(pending).rejects.toBeInstanceOf(ImportOutcomeUnknownError);
        await settle();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
        await settle();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
        await assertion;

        proxy.updateConfig({ ...panel, maxFood: DIVERGED_MAX_FOOD });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);

        const world = await proxy.exportState();
        expect(world.config).toMatchObject({ maxFood: DIVERGED_MAX_FOOD, maxOrganisms: restored.config.maxOrganisms });
    });

    it('a panel that sends its unchanged configuration sends nothing to the worker', () => {
        const panel: SimulationConfig = { ...proxy.config };

        proxy.updateConfig({ ...panel });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);

        expect(bridge.commands.filter((command) => command.type === 'setConfig')).toHaveLength(0);
    });

    it('a panel that changes one setting sends that setting alone', () => {
        const panel: SimulationConfig = { ...proxy.config };

        proxy.updateConfig({ ...panel, maxFood: CHANGED_MAX_FOOD });
        vi.advanceTimersByTime(CONFIG_BATCH_DEBOUNCE_MS);

        expect(bridge.commands).toContainEqual({ type: 'setConfig', config: { maxFood: CHANGED_MAX_FOOD } });
    });
});
