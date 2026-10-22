/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWorldConfig } from '@/config';
import { ImportOutcomeUnknownError } from '@/core';
import type { SerializedSimulationStateV1, SimulationConfig } from '@/types';

import { EngineProxy } from '../engine/EngineProxy';
import type { WorkerChannel } from '../engine/WorkerChannel.service';
import type { WorkerCommand } from '../WorkerMessages';

interface WorkerStub {
  postMessage: (command: WorkerCommand | Record<string, unknown>) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
}

const createState = (): SerializedSimulationStateV1 => ({
  version: 1,
  seed: 1,
  rngState: 1,
  tick: 1,
  counters: {
    foodIdCounter: 0,
    obstacleIdCounter: 0,
    organismIdCounter: 0,
    genomeIdCounter: 0,
  },
  stats: {
    totalDeaths: 0,
    totalBirths: 0,
    maxAge: 0,
    maxGeneration: 0,
  },
  config: {
    foodSpawnRate: 0.2,
    maxFood: 100,
    maxOrganisms: 200,
    showObstacles: true,
    mutationFactor: 0.1,
    reproductionThreshold: 220,
    organismOpacity: 1,
    foodOpacity: 1,
    organismScale: 1,
    foodScale: 1,
    bloomIntensity: 1,
    showGrid: false,
    gridOpacity: 0.5,
    trailLength: 20,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'CUSTOM',
    drag: 0.95,
    separationWeight: 1,
    alignmentWeight: 1,
    cohesionWeight: 1,
    seekWeight: 1,
    avoidWeight: 1,
  },
  zones: [],
  obstacles: [],
  food: [],
  organisms: [],
  geneticTree: {
    roots: [],
    nodes: [],
  },
});

// WorkerChannel's ASYNC_COMMAND_TIMEOUT_MS. The channel does not export it, so the test states the value.
const ASYNC_COMMAND_TIMEOUT_MS = 5000;

// What the worker acknowledges an importState with. Shape matches the worker's ack.
const acknowledgement = (config: SimulationConfig): Record<string, unknown> => ({
  tick: 1,
  stats: {
    preyCount: 0, predatorCount: 0, foodCount: 0, avgEnergy: 0, avgPreyEnergy: 0, avgPredatorEnergy: 0,
    generation: 0, maxGeneration: 0, maxAge: 0, totalDeaths: 0, totalBirths: 0, extinctionRisk: 0,
  },
  config,
  worldConfig: createWorldConfig(1),
  zones: new Map(),
  obstacles: new Map(),
});

describe('EngineProxy command optimization', () => {
  let postedMessages: (WorkerCommand | Record<string, unknown>)[];
  let workerStub: WorkerStub;
  let proxy: EngineProxy;

  const respond = (data: Record<string, unknown>): void => {
    (proxy as unknown as { channel: WorkerChannel }).channel.dispatch({ data } as MessageEvent);
  };

  // Lets the proxy's pending continuations run, so the command they send is posted before the test looks for it.
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    postedMessages = [];
    workerStub = {
      postMessage: (command) => {
        postedMessages.push(command);
      },
      terminate: vi.fn(),
      onmessage: null,
    };

    proxy = new EngineProxy();
    const target = proxy as unknown as { worker: WorkerStub; isInitialized: boolean };
    target.worker = workerStub;
    target.isInitialized = true;
  });

  it('deduplicates repeated setSpeed commands', () => {
    proxy.setSpeed(1);
    proxy.setSpeed(1);
    proxy.setSpeed(2);

    const speedCommands = postedMessages.filter((msg) => msg.type === 'setSpeed');
    expect(speedCommands).toHaveLength(2);
  });

  it('batches multiple config updates into a single worker message', () => {
    proxy.updateConfig({ maxFood: 150 });
    proxy.updateConfig({ maxOrganisms: 350 });

    vi.advanceTimersByTime(40);

    const setConfigCommands = postedMessages.filter((msg) => msg.type === 'setConfig');
    expect(setConfigCommands).toHaveLength(1);
    expect(setConfigCommands[0]).toMatchObject({
      type: 'setConfig',
      config: { maxFood: 150, maxOrganisms: 350 },
    });
  });

  it('flushes pending config before critical reset command to preserve ordering', () => {
    proxy.updateConfig({ maxFood: 180 });
    proxy.reset();

    const setConfigIndex = postedMessages.findIndex((msg) => msg.type === 'setConfig');
    const resetIndex = postedMessages.findIndex((msg) => msg.type === 'reset');
    const updateIndex = postedMessages.findIndex((msg) => msg.type === 'update');

    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(setConfigIndex).toBeLessThan(resetIndex);
    expect(resetIndex).toBeLessThan(updateIndex);
  });

  it('does not drop critical loop transitions while deduplicating duplicates', () => {
    proxy.pause();
    proxy.pause();
    proxy.resume();
    proxy.resume();
    proxy.pause();

    const loopCommands = postedMessages
      .filter((msg) => msg.type === 'startLoop' || msg.type === 'stopLoop')
      .map((msg) => msg.type);

    expect(loopCommands).toEqual(['stopLoop', 'startLoop', 'stopLoop']);
  });

  it('flushes pending config before exportState command', () => {
    proxy.updateConfig({ maxOrganisms: 420 });
    void proxy.exportState();

    const setConfigIndex = postedMessages.findIndex((msg) => msg.type === 'setConfig');
    const exportIndex = postedMessages.findIndex((msg) => msg.type === 'exportState');

    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(exportIndex).toBeGreaterThanOrEqual(0);
    expect(setConfigIndex).toBeLessThan(exportIndex);
  });

  it('flushes pending config before importState command', () => {
    proxy.updateConfig({ maxFood: 190 });
    void proxy.importState(createState());

    const setConfigIndex = postedMessages.findIndex((msg) => msg.type === 'setConfig');
    const importIndex = postedMessages.findIndex((msg) => msg.type === 'importState');

    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(importIndex).toBeGreaterThanOrEqual(0);
    expect(setConfigIndex).toBeLessThan(importIndex);
  });

  it('preserves order for setSpeed -> pause -> setSpeed -> run', () => {
    proxy.setSpeed(2);
    proxy.pause();
    proxy.setSpeed(1);
    proxy.resume();

    const ordered = postedMessages.map((msg) => msg.type);
    expect(ordered).toEqual(['setSpeed', 'stopLoop', 'setSpeed', 'startLoop']);
  });

  it('keeps repeated run/pause/stop transitions stable', () => {
    proxy.resume();
    proxy.pause();
    proxy.pause();
    proxy.resume();
    proxy.pause();
    proxy.resume();

    const transitions = postedMessages
      .filter((msg) => msg.type === 'startLoop' || msg.type === 'stopLoop')
      .map((msg) => msg.type);

    expect(transitions).toEqual(['startLoop', 'stopLoop', 'startLoop', 'stopLoop', 'startLoop']);
  });

  it('exportState resolves with the worker result for its own request and never returns a fallback', async () => {
    const pending = proxy.exportState();
    const command = postedMessages.find((msg) => msg.type === 'exportState') as { requestId?: string } | undefined;

    expect(command?.requestId).toBeDefined();
    respond({ type: 'commandResponse', requestId: command?.requestId, result: createState() });

    await expect(pending).resolves.toEqual(createState());
  });

  it('correlates concurrent exports with the responses to their own requests', async () => {
    const first = proxy.exportState();
    const second = proxy.exportState();
    const [firstCommand, secondCommand] = postedMessages.filter((msg) => msg.type === 'exportState') as { requestId: string }[];

    respond({ type: 'commandResponse', requestId: secondCommand?.requestId, result: { ...createState(), tick: 2 } });
    respond({ type: 'commandResponse', requestId: firstCommand?.requestId, result: { ...createState(), tick: 1 } });

    await expect(first).resolves.toMatchObject({ tick: 1 });
    await expect(second).resolves.toMatchObject({ tick: 2 });
  });

  it('keeps a config update made while an import is pending, on top of the acknowledged configuration', async () => {
    const pending = proxy.importState(createState());
    proxy.updateConfig({ maxFood: 333 });
    const prepare = postedMessages.find((msg) => msg.type === 'importState') as { requestId?: string } | undefined;
    respond({ type: 'commandResponse', requestId: prepare?.requestId, result: { prepared: true } });
    await settle();
    const commit = postedMessages.find((msg) => msg.type === 'commitImport') as { requestId?: string } | undefined;

    // The worker applies the update after the import, so the acknowledgement does not contain it.
    respond({ type: 'commandResponse', requestId: commit?.requestId, result: acknowledgement({ ...createState().config, maxFood: 111 }) });

    await pending;
    expect(proxy.config.maxFood).toBe(333);
  });

  it('importState resolves only after the worker commits it, and refreshes the cached configuration', async () => {
    const restoredConfig = { ...createState().config, maxFood: 111 };
    const pending = proxy.importState(createState());
    const prepare = postedMessages.find((msg) => msg.type === 'importState') as { requestId?: string } | undefined;

    expect(prepare?.requestId).toBeDefined();
    respond({ type: 'commandResponse', requestId: prepare?.requestId, result: { prepared: true } });
    await settle();
    const commit = postedMessages.find((msg) => msg.type === 'commitImport') as { requestId?: string } | undefined;
    expect(commit?.requestId).toBeDefined();

    let isSettled = false;
    void pending.then(() => { isSettled = true; });
    await settle();
    expect(isSettled).toBe(false);

    respond({ type: 'commandResponse', requestId: commit?.requestId, result: acknowledgement(restoredConfig) });

    await expect(pending).resolves.toBeUndefined();
    expect(proxy.config).toEqual(restoredConfig);
  });

  it('a timed-out import is cancelled in the worker, and the proxy never sends its commit', async () => {
    const pending = proxy.importState(createState());
    const assertion = expect(pending).rejects.toThrow('Timeout for command importState');
    const prepare = postedMessages.find((msg) => msg.type === 'importState') as { importToken?: string } | undefined;

    vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);

    await assertion;
    expect(postedMessages).toContainEqual({ type: 'cancelImport', importToken: prepare?.importToken });
    expect(postedMessages.some((msg) => msg.type === 'commitImport')).toBe(false);
  });

  it('a commit and its probe with no answer are reported as an unknown outcome after both bounds, never as a failure', async () => {
    const pending = proxy.importState(createState());
    const prepare = postedMessages.find((msg) => msg.type === 'importState') as { requestId?: string } | undefined;
    respond({ type: 'commandResponse', requestId: prepare?.requestId, result: { prepared: true } });
    await settle();

    const assertion = expect(pending).rejects.toBeInstanceOf(ImportOutcomeUnknownError);
    vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);
    await settle();
    vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);

    await assertion;
  });

  it('a commit the worker refuses is reported with the worker\'s reason, not as an unknown outcome', async () => {
    const pending = proxy.importState(createState());
    const prepare = postedMessages.find((msg) => msg.type === 'importState') as { requestId?: string } | undefined;
    respond({ type: 'commandResponse', requestId: prepare?.requestId, result: { prepared: true } });
    await settle();
    const commit = postedMessages.find((msg) => msg.type === 'commitImport') as { requestId?: string } | undefined;

    respond({ type: 'commandError', requestId: commit?.requestId, message: 'The import failed before the swap, so the live world is unchanged: bad tick' });

    const error = await pending.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ImportOutcomeUnknownError);
    expect((error as Error).message).toContain('the live world is unchanged');
  });

  it('importState rejects with the reason the worker reports instead of logging and resolving', async () => {
    const pending = proxy.importState(createState());
    const command = postedMessages.find((msg) => msg.type === 'importState') as { requestId?: string } | undefined;

    respond({ type: 'commandError', requestId: command?.requestId, message: 'Invalid simulation snapshot: tick must be a finite number' });

    await expect(pending).rejects.toThrow('Invalid simulation snapshot: tick must be a finite number');
  });

  it('importState rejects with a named timeout when the worker never answers', async () => {
    const pending = proxy.importState(createState());
    const assertion = expect(pending).rejects.toThrow('Timeout for command importState');

    vi.advanceTimersByTime(ASYNC_COMMAND_TIMEOUT_MS + 1);

    await assertion;
  });

  it('dispose rejects the requests that are still waiting', async () => {
    const pending = proxy.exportState();

    proxy.dispose();

    await expect(pending).rejects.toThrow(/disposed/);
  });

  it('sends getEntityByInstanceId command with correct fields', async () => {
    const promise = proxy.getEntityByInstanceId('prey', 3, false).catch(() => null);

    const cmd = postedMessages.find((msg) => msg.type === 'getEntityByInstanceId') as
      | { requestId?: string; entityType?: string; instanceId?: number; isDead?: boolean }
      | undefined;

    expect(cmd).toBeDefined();
    expect(cmd?.entityType).toBe('prey');
    expect(cmd?.instanceId).toBe(3);
    expect(cmd?.isDead).toBe(false);
    expect(cmd?.requestId).toBeDefined();

    (proxy as unknown as { channel: WorkerChannel }).channel.dispatch({
      data: { type: 'commandResponse', requestId: cmd?.requestId, result: null },
    } as MessageEvent);

    await expect(promise).resolves.toBeNull();
  });

  it('sends findEntityAt command with correct fields', async () => {
    const pos = { x: 10, y: 0, z: 5 };
    const promise = proxy.findEntityAt(pos, 2).catch(() => null);

    const cmd = postedMessages.find((msg) => msg.type === 'findEntityAt') as
      | { requestId?: string; position?: object; tolerance?: number }
      | undefined;

    expect(cmd).toBeDefined();
    expect(cmd?.position).toEqual(pos);
    expect(cmd?.tolerance).toBe(2);

    (proxy as unknown as { channel: WorkerChannel }).channel.dispatch({
      data: { type: 'commandResponse', requestId: cmd?.requestId, result: null },
    } as MessageEvent);

    await expect(promise).resolves.toBeNull();
  });

  it('clears async timeout once command response arrives', async () => {
    const pendingRejection = vi.fn();

    const requestPromise = proxy.getGeneticRoots().catch((error: unknown) => {
      pendingRejection(error);
      throw error;
    });

    const command = postedMessages.find((msg) => msg.type === 'getGeneticRoots') as
      | { requestId?: string }
      | undefined;

    expect(command?.requestId).toBeDefined();

    (proxy as unknown as { channel: WorkerChannel }).channel.dispatch({
      data: {
        type: 'commandResponse',
        requestId: command?.requestId,
        result: [],
      },
    } as MessageEvent);

    await expect(requestPromise).resolves.toEqual([]);

    vi.advanceTimersByTime(6000);

    expect(pendingRejection).not.toHaveBeenCalled();
  });
});
