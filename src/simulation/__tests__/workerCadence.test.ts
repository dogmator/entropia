import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RENDER_SNAPSHOT_FPS,
  DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
  shouldDispatchRenderSnapshot,
} from '../workerCadence';

const EXPECTED_DEFAULT_RENDER_SNAPSHOT_FPS = 30;
const MILLISECONDS_PER_SECOND = 1000;

describe('workerCadence', () => {
  it('exports a 30 FPS default render cadence', () => {
    expect(DEFAULT_RENDER_SNAPSHOT_FPS).toBe(EXPECTED_DEFAULT_RENDER_SNAPSHOT_FPS);
    expect(DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS).toBeCloseTo(
      MILLISECONDS_PER_SECOND / EXPECTED_DEFAULT_RENDER_SNAPSHOT_FPS
    );
  });

  it('does not dispatch snapshot when simulation did not advance', () => {
    expect(shouldDispatchRenderSnapshot({
      updated: false,
      now: 100,
      lastSnapshotTime: 0,
      minIntervalMs: DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
    })).toBe(false);
  });

  it('does not dispatch snapshot before cadence interval elapsed', () => {
    expect(shouldDispatchRenderSnapshot({
      updated: true,
      now: 20,
      lastSnapshotTime: 0,
      minIntervalMs: DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
    })).toBe(false);
  });

  it('dispatches snapshot once cadence interval elapsed', () => {
    expect(shouldDispatchRenderSnapshot({
      updated: true,
      now: DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
      lastSnapshotTime: 0,
      minIntervalMs: DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS,
    })).toBe(true);
  });
});
