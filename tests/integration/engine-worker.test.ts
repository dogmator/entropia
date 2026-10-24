/* eslint-disable @typescript-eslint/no-magic-numbers */
 
/**
 * The real worker module and the real EngineProxy, linked in one process. A reset, a stop and a resume are checked the way the
 * view receives them: through the worker's messages, the proxy's state, and the instance writer that the canvas uses.
 */
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUFFER_LAYOUT } from '@/config';
import { EngineProxy } from '@/simulation/engine/EngineProxy';
import type { SimulationEvent } from '@/types';
import { writeOrganismInstances } from '@/ui/components/instanceMeshes';

const SCALE = 1;
const FRAME_MS = 1000 / 60;
// One frame is one tick. The engine stops after 180 ticks with no organism, so this many frames leave ample margin.
const FAILSAFE_FRAMES = 260;
const VIEW_EXTENT = 1e6;

type WorkerHandler = (event: MessageEvent<unknown>) => void;

/** The listener the proxy set on the Worker it created. The worker module's posts are delivered to it. */
let proxyListener: WorkerHandler | null = null;

/**
 * The Worker the proxy creates. The proxy's posts reach the worker module, which listens on the global scope. The module's posts
 * reach the listener that the proxy sets through `onmessage`.
 */
class LinkedWorker {
  public onerror: ((event: ErrorEvent) => void) | null = null;

  public set onmessage(handler: WorkerHandler | null) {
    proxyListener = handler;
  }

  public postMessage(data: unknown): void {
    const handler = self.onmessage as WorkerHandler | null;
    handler?.({ data } as MessageEvent<unknown>);
  }

  public terminate(): void {
    proxyListener = null;
  }
}

let clock = 0;

const advanceFrames = (frames: number): void => {
  for (let i = 0; i < frames; i++) {
    clock += FRAME_MS;
    vi.advanceTimersByTime(FRAME_MS);
  }
};

/** A world that is running, as the view starts it: initialised, then resumed by its speed. */
const startWorld = async (): Promise<EngineProxy> => {
  const proxy = new EngineProxy({ tickRate: 60 });
  const ready = proxy.init(SCALE);
  // The worker module announces itself as soon as it loads, so the proxy must already be listening.
  await import('../../src/simulation/simulation.worker');
  await ready;
  proxy.resume();
  return proxy;
};

/** A frustum that holds every body of the world, so the writer draws all of them. */
const everythingInView = (): THREE.Frustum => {
  const camera = new THREE.OrthographicCamera(-VIEW_EXTENT, VIEW_EXTENT, VIEW_EXTENT, -VIEW_EXTENT, -VIEW_EXTENT, VIEW_EXTENT);
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return frustum;
};

const POSITION_TOLERANCE = 1e-3;

/**
 * Checks every living body the view holds against the engine's own organism of the same id: the id must name an organism, and
 * that organism must stand where the body is drawn. A snapshot of the world before a reset fails this, even when the counts match.
 */
const drawnBodiesMatchTheEngine = async (proxy: EngineProxy): Promise<{ checked: number; mismatched: number }> => {
  const buffers = proxy.getRenderData();
  let checked = 0;
  let mismatched = 0;
  const checks: Promise<void>[] = [];
  for (let i = 0; i < buffers.preyCount; i++) {
    const offset = i * BUFFER_LAYOUT.STRIDE;
    const id = buffers.prey[offset + BUFFER_LAYOUT.OFFSETS.ID] ?? -1;
    const x = buffers.prey[offset + BUFFER_LAYOUT.OFFSETS.X] ?? NaN;
    const y = buffers.prey[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? NaN;
    const z = buffers.prey[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? NaN;
    checks.push(proxy.getEntityByNumericId('prey', id, false).then(org => {
      checked++;
      const isWhereDrawn = org !== null
        && Math.abs(org.position.x - x) < POSITION_TOLERANCE
        && Math.abs(org.position.y - y) < POSITION_TOLERANCE
        && Math.abs(org.position.z - z) < POSITION_TOLERANCE;
      if (!isWhereDrawn) mismatched++;
    }));
  }
  await Promise.all(checks);
  return { checked, mismatched };
};

const deadEntries = (data: Float32Array, count: number): number => {
  let dead = 0;
  for (let i = 0; i < count; i++) {
    if ((data[i * BUFFER_LAYOUT.STRIDE + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD) dead++;
  }
  return dead;
};

/** What the canvas draws of the prey in the proxy's current render data, with the id each drawn instance names. */
const drawnPrey = (proxy: EngineProxy): { aliveCount: number; deadCount: number; aliveIds: number[] } => {
  const buffers = proxy.getRenderData();
  const alive = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
  const dead = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
  const aliveIds: number[] = [];
  const deadIds: number[] = [];
  writeOrganismInstances(
    { aliveMesh: alive, deadMesh: dead, aliveIds, deadIds },
    { data: buffers.prey, count: buffers.preyCount, scaleMultiplier: 1, frustum: everythingInView() },
  );
  return { aliveCount: alive.count, deadCount: dead.count, aliveIds };
};

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('Worker', LinkedWorker);
  vi.spyOn(self, 'postMessage').mockImplementation((message: unknown) => {
    proxyListener?.({ data: message } as MessageEvent<unknown>);
  });
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Stops the engine by itself, the way the extinction fail-safe does: the snapshot of the world is kept, with no organism in it. */
const emptyTheWorld = async (proxy: EngineProxy): Promise<void> => {
  const state = await proxy.exportState();
  await proxy.importState({ ...state, organisms: [] });
};

describe('EngineProxy with the real worker — reset', () => {
  it('a reset while the loop runs shows the new world at once, not the one before it', async () => {
    const proxy = await startWorld();
    advanceFrames(40);
    expect(proxy.getStats().generation).toBeGreaterThan(0);

    proxy.reset();

    const stats = proxy.getStats();
    const buffers = proxy.getRenderData();
    expect(stats.preyCount).toBeGreaterThan(0);
    expect(buffers.preyCount).toBe(stats.preyCount);
    expect(buffers.predatorCount).toBe(stats.predatorCount);
    expect(deadEntries(buffers.prey, buffers.preyCount)).toBe(0);
    expect(await drawnBodiesMatchTheEngine(proxy)).toEqual({ checked: stats.preyCount, mismatched: 0 });

    const drawn = drawnPrey(proxy);
    expect(drawn.aliveCount).toBe(stats.preyCount);
    expect(drawn.deadCount).toBe(0);
    for (const id of drawn.aliveIds) {
      expect(await proxy.getEntityByNumericId('prey', id, false)).not.toBeNull();
    }
  });

  it('a reset while paused shows the new world, and the paused world does not advance', async () => {
    const proxy = await startWorld();
    advanceFrames(40);
    proxy.pause();
    advanceFrames(5);

    proxy.reset();
    const shown = proxy.getRenderData();
    expect(proxy.getStats().generation).toBe(0);
    expect(shown.preyCount).toBe(proxy.getStats().preyCount);
    expect(await drawnBodiesMatchTheEngine(proxy)).toEqual({ checked: shown.preyCount, mismatched: 0 });

    advanceFrames(60);
    expect(proxy.getStats().generation).toBe(0);
    expect(proxy.getRenderData().preyCount).toBe(shown.preyCount);
  });
});

describe('EngineProxy with the real worker — a stop the engine makes itself', () => {
  it('reaches the view once, and the world stays still afterwards', async () => {
    const proxy = await startWorld();
    advanceFrames(20);
    await emptyTheWorld(proxy);
    const seen: SimulationEvent['type'][] = [];
    proxy.addEventListener(event => { seen.push(event.type); });

    advanceFrames(FAILSAFE_FRAMES);

    expect(seen.filter(type => type === 'EngineStopped')).toHaveLength(1);
    expect(proxy.getStats().preyCount).toBe(0);
    const settled = seen.length;
    advanceFrames(60);
    expect(seen).toHaveLength(settled);
  });

  it('a resume after the stop starts the loop again', async () => {
    const proxy = await startWorld();
    advanceFrames(20);
    await emptyTheWorld(proxy);
    const seen: SimulationEvent['type'][] = [];
    proxy.addEventListener(event => { seen.push(event.type); });
    advanceFrames(FAILSAFE_FRAMES);
    const stoppedAt = seen.length;

    proxy.resume();
    advanceFrames(5);

    expect(seen.length).toBeGreaterThan(stoppedAt);
  });
});
