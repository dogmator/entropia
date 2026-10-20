/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
