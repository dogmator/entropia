import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { EngineProxy } from '../EngineProxy';
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

describe('EngineProxy command optimization', () => {
  let postedMessages: Array<WorkerCommand | Record<string, unknown>>;
  let workerStub: WorkerStub;
  let proxy: EngineProxy;

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

    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(setConfigIndex).toBeLessThan(resetIndex);
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
    proxy.exportState();

    const setConfigIndex = postedMessages.findIndex((msg) => msg.type === 'setConfig');
    const exportIndex = postedMessages.findIndex((msg) => msg.type === 'exportState');

    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(exportIndex).toBeGreaterThanOrEqual(0);
    expect(setConfigIndex).toBeLessThan(exportIndex);
  });

  it('flushes pending config before importState command', () => {
    proxy.updateConfig({ maxFood: 190 });
    proxy.importState(createState());

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

  it('returns fallback export state while async export is in progress', () => {
    const exported = proxy.exportState();

    expect(exported.version).toBe(1);
    expect(postedMessages.some((msg) => msg.type === 'exportState')).toBe(true);
  });

  it('sends importState command to worker', () => {
    const state = createState();
    proxy.importState(state);

    expect(postedMessages.some((msg) => msg.type === 'importState')).toBe(true);
  });
});
