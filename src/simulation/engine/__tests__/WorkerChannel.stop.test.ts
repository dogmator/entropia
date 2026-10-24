import { describe, expect, it, vi } from 'vitest';

import { INITIAL_SIMULATION_STATS } from '@/config';
import type { RenderBuffers, SimulationEvent, SimulationStats } from '@/types';

import { WorkerChannel } from '../WorkerChannel.service';

const STOP_TICK = 42;

const stats = INITIAL_SIMULATION_STATS as unknown as SimulationStats;
const buffers: RenderBuffers = {
  prey: new Float32Array(0),
  predators: new Float32Array(0),
  food: new Float32Array(0),
  preyCount: 0,
  predatorCount: 0,
  foodCount: 0,
};

const createChannel = (): WorkerChannel => new WorkerChannel(() => null, {
  onStateUpdate: vi.fn(),
  onBuffersUpdate: vi.fn(),
  onStatsUpdate: vi.fn(),
  onError: vi.fn(),
  tickRate: 60,
});

const eventsOf = (channel: WorkerChannel, data: unknown): string[] => {
  const seen: SimulationEvent[] = [];
  channel.addEventListener(event => { seen.push(event); });
  channel.dispatch({ data } as MessageEvent);
  return seen.map(event => event.type);
};

describe('WorkerChannel — a stop the engine made itself', () => {
  it('reports the stop with the snapshot that carries it', () => {
    const types = eventsOf(createChannel(), { type: 'updated', buffers, stats, tick: STOP_TICK, stoppedByEngine: true });

    expect(types).toEqual(['TickUpdated', 'EngineStopped']);
  });

  it('reports nothing extra for an ordinary snapshot', () => {
    const types = eventsOf(createChannel(), { type: 'updated', buffers, stats, tick: STOP_TICK });

    expect(types).toEqual(['TickUpdated']);
  });
});
