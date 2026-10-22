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

const RESTORED_MAX_FOOD = 123;

describe('an import whose commit answer is lost', () => {
    let proxy: EngineProxy;
    let bridge: WorkerBridge;

    const snapshotWithMaxFood = async (maxFood: number): Promise<SerializedSimulationStateV1> => {
        const live = await proxy.exportState();
        return { ...live, config: { ...live.config, maxFood } };
    };

    // The commit is sent once the prepare is answered. Its bound then runs out, and the proxy goes on to the probe.
    const runOutTheCommitBound = async (): Promise<void> => {
        await settle();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
        await settle();
    };

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        proxy = new EngineProxy();
        bridge = await bridgeProxyToWorker(proxy);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('resolves when the worker reports the commit was applied, and the proxy then matches the worker', async () => {
        const restored = await snapshotWithMaxFood(RESTORED_MAX_FOOD);
        bridge.loseAnswer = isAnswerTo('commitImport');

        const pending = proxy.importState(restored);
        await runOutTheCommitBound();

        await expect(pending).resolves.toBeUndefined();
        const live = await proxy.exportState();
        expect(live.config.maxFood).toBe(RESTORED_MAX_FOOD);
        expect(proxy.config).toEqual(live.config);
    });

    it('rejects with the reason the commit was not applied, and the live world stays as it was', async () => {
        const before = await proxy.exportState();
        const restored = await snapshotWithMaxFood(RESTORED_MAX_FOOD);
        bridge.loseCommand = (command) => command.type === 'commitImport';

        const pending = proxy.importState(restored);
        const assertion = expect(pending).rejects.toThrow('the live world is unchanged');
        await runOutTheCommitBound();

        await assertion;
        expect(bridge.commands).toContainEqual(expect.objectContaining({ type: 'cancelImport' }));
        expect((await proxy.exportState()).config).toEqual(before.config);
    });

    it('stays unknown when the worker answers neither the commit nor the probe', async () => {
        const restored = await snapshotWithMaxFood(RESTORED_MAX_FOOD);
        bridge.loseAnswer = (answer) => isAnswerTo('commitImport')(answer) || isAnswerTo('probeImport')(answer);

        const pending = proxy.importState(restored);
        const assertion = expect(pending).rejects.toBeInstanceOf(ImportOutcomeUnknownError);
        await runOutTheCommitBound();
        vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);

        await assertion;
    });
});
