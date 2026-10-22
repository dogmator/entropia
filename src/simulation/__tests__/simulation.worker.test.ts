/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import type { WorkerResponse } from '../WorkerMessages';

const FRAME_MS = 1000 / 60;
const SCALE = 1;
const TEST_SPEED = 1;

type MessageHandler = (event: MessageEvent<unknown>) => void;

let clock = 0;
let posted: WorkerResponse[] = [];

const send = (data: unknown): void => {
  const handler = self.onmessage as MessageHandler | null;
  handler?.({ data } as MessageEvent<unknown>);
};

const responsesOfType = <T extends WorkerResponse['type']>(type: T): Extract<WorkerResponse, { type: T }>[] =>
  posted.filter((msg): msg is Extract<WorkerResponse, { type: T }> => msg.type === type);

/** Loads a fresh worker module so each test starts with an uninitialised engine. */
const loadWorker = async (): Promise<void> => {
  vi.resetModules();
  await import('../simulation.worker');
};

beforeEach(() => {
  posted = [];
  clock = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(self, 'postMessage').mockImplementation((message: unknown) => {
    posted.push(message as WorkerResponse);
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advanceFrames = (frames: number): void => {
  for (let i = 0; i < frames; i++) {
    clock += FRAME_MS;
    vi.advanceTimersByTime(FRAME_MS);
  }
};

describe('simulation worker — command handling', () => {
  it('signals readiness on load', async () => {
    await loadWorker();

    expect(posted.map(msg => msg.type)).toEqual(['ready']);
  });

  it('ignores messages that do not carry a command type', async () => {
    await loadWorker();

    send(null);
    send('init');
    send({});
    send({ type: 42 });

    expect(posted.map(msg => msg.type)).toEqual(['ready']);
  });

  it('rejects an unknown command with an error response instead of throwing', async () => {
    await loadWorker();

    expect(() => { send({ type: 'definitelyNotACommand' }); }).not.toThrow();

    const errors = responsesOfType('error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('Unknown command');
  });

  it('ignores engine commands that arrive before init', async () => {
    await loadWorker();

    send({ type: 'update' });
    send({ type: 'getStats' });
    send({ type: 'reset' });

    expect(posted.map(msg => msg.type)).toEqual(['ready']);
  });

  it('answers init with the initialised engine state', async () => {
    await loadWorker();

    send({ type: 'init', scale: SCALE });

    const [initialized] = responsesOfType('initialized');
    expect(initialized).toBeDefined();
    expect(initialized?.stats).toBeDefined();
    expect(initialized?.config).toBeDefined();
  });

  it('rejects a setSpeed command whose speed is not a finite number', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'startLoop' });

    send({ type: 'setSpeed', speed: Number.NaN });

    expect(responsesOfType('error').length).toBeGreaterThan(0);
  });

  it('keeps advancing the simulation after an invalid setSpeed command', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'startLoop' });
    send({ type: 'setSpeed', speed: Number.NaN });
    posted = [];

    advanceFrames(10);

    expect(responsesOfType('updated').length).toBeGreaterThan(0);
  });

  it('keeps advancing the simulation after a valid setSpeed command', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'setSpeed', speed: TEST_SPEED });
    send({ type: 'startLoop' });
    posted = [];

    advanceFrames(10);

    expect(responsesOfType('updated').length).toBeGreaterThan(0);
  });
});

describe('simulation worker — lifecycle', () => {
  it('runs the loop after startLoop and stops emitting updates after stopLoop', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'startLoop' });
    advanceFrames(5);
    expect(responsesOfType('updated').length).toBeGreaterThan(0);

    send({ type: 'stopLoop' });
    posted = [];
    advanceFrames(30);

    expect(responsesOfType('updated')).toHaveLength(0);
  });

  it('resets the engine and reports fresh stats, then accepts a new init', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'update' });
    posted = [];

    send({ type: 'reset' });
    expect(responsesOfType('stats')).toHaveLength(1);

    posted = [];
    send({ type: 'init', scale: SCALE });
    expect(responsesOfType('initialized')).toHaveLength(1);
  });

  it('merges setConfig into the engine config and reports stats', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    posted = [];

    send({ type: 'setConfig', config: { maxFood: 123 } });

    expect(responsesOfType('stats')).toHaveLength(1);
  });
});

describe('simulation worker — snapshot commands', () => {
  const EXPORT_REQUEST = 'exportState_1';
  const IMPORT_REQUEST = 'importState_2';

  const answersFor = (requestId: string): WorkerResponse[] =>
    posted.filter(msg => (msg.type === 'commandResponse' || msg.type === 'commandError') && msg.requestId === requestId);

  const exportLiveState = (requestId: string): SerializedSimulationStateV1 => {
    send({ type: 'exportState', requestId });
    const [answer] = answersFor(requestId);
    if (answer?.type !== 'commandResponse') throw new Error(`export was not answered with a result: ${JSON.stringify(answer)}`);
    return answer.result as SerializedSimulationStateV1;
  };

  it('answers exportState with the snapshot under the request id it was sent with', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });

    const snapshot = exportLiveState(EXPORT_REQUEST);

    expect(snapshot.version).toBe(1);
    expect(snapshot.tick).toBe(0);
  });

  it('exports the tick the loop has reached, not an earlier one', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'startLoop' });
    advanceFrames(60);

    const snapshot = exportLiveState(EXPORT_REQUEST);
    const lastReported = responsesOfType('updated').at(-1)?.tick ?? 0;

    expect(snapshot.tick).toBeGreaterThan(0);
    expect(snapshot.tick).toBeGreaterThanOrEqual(lastReported);
  });

  it('answers importState with a correlated acknowledgement carrying the restored configuration', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    const snapshot = exportLiveState(EXPORT_REQUEST);
    posted = [];

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: { ...snapshot, config: { ...snapshot.config, maxFood: 123 } } });

    const [answer] = answersFor(IMPORT_REQUEST);
    expect(answer?.type).toBe('commandResponse');
    expect(answer?.type === 'commandResponse' && (answer.result as { config: { maxFood: number } }).config.maxFood).toBe(123);
  });

  it('reports a rejected importState as a commandError carrying the rejection reason', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    posted = [];

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: { version: 2 } });

    const [answer] = answersFor(IMPORT_REQUEST);
    expect(answer?.type).toBe('commandError');
    expect(answer?.type === 'commandError' && answer.message).toContain('Unsupported simulation snapshot version');
  });

  it('keeps the live engine unchanged when an import is rejected', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    const before = JSON.stringify(exportLiveState(EXPORT_REQUEST));

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: { version: 2 } });

    expect(JSON.stringify(exportLiveState('exportState_3'))).toBe(before);
  });

  it('keeps the live engine unchanged when the import fails after it has already applied the snapshot', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    const snapshot = exportLiveState(EXPORT_REQUEST);
    const before = JSON.stringify(exportLiveState('exportState_3'));
    const { PersistenceService } = await import('../services/Persistence.service');
    const applySnapshot = PersistenceService.importState.bind(PersistenceService);
    vi.spyOn(PersistenceService, 'importState').mockImplementationOnce((engine, state) => {
      applySnapshot(engine, state);
      throw new Error('injected failure after the snapshot was applied');
    });

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: snapshot });

    const [answer] = answersFor(IMPORT_REQUEST);
    expect(answer?.type === 'commandError' && answer.message).toContain('injected failure after the snapshot was applied');
    expect(JSON.stringify(exportLiveState('exportState_4'))).toBe(before);
  });

  it('answers snapshot commands sent before init with a commandError instead of silence', async () => {
    await loadWorker();

    send({ type: 'exportState', requestId: EXPORT_REQUEST });
    send({ type: 'importState', requestId: IMPORT_REQUEST, state: { version: 1 } });

    expect(answersFor(EXPORT_REQUEST).map(msg => msg.type)).toEqual(['commandError']);
    expect(answersFor(IMPORT_REQUEST).map(msg => msg.type)).toEqual(['commandError']);
  });

  it('publishes the restored world while the loop is stopped, without advancing it', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    const snapshot = exportLiveState(EXPORT_REQUEST);
    posted = [];

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: snapshot });

    const [published] = responsesOfType('updated');
    expect(published?.tick).toBe(snapshot.tick);
    expect(answersFor(IMPORT_REQUEST).map(msg => msg.type)).toEqual(['commandResponse']);
  });

  it('keeps a running loop running after a successful import', async () => {
    await loadWorker();
    send({ type: 'init', scale: SCALE });
    send({ type: 'startLoop' });
    advanceFrames(5);
    const snapshot = exportLiveState(EXPORT_REQUEST);
    posted = [];

    send({ type: 'importState', requestId: IMPORT_REQUEST, state: snapshot });
    advanceFrames(10);

    expect(responsesOfType('updated').length).toBeGreaterThan(0);
  });
});
