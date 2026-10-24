/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { createRenderMetrics } from '../renderMetrics';

const SIXTY_HZ_FRAME_MS = 1000 / 60;

describe('createRenderMetrics', () => {
  it('reports the frame rate the canvas actually drew at', () => {
    const metrics = createRenderMetrics();
    let now = 0;
    for (let i = 0; i < 130; i++) {
      now += SIXTY_HZ_FRAME_MS;
      metrics.recordFrame(now, 7);
    }

    const snapshot = metrics.snapshot();
    expect(snapshot.fps).toBeGreaterThanOrEqual(59);
    expect(snapshot.fps).toBeLessThanOrEqual(61);
    expect(snapshot.frameTime).toBeGreaterThan(SIXTY_HZ_FRAME_MS - 0.5);
    expect(snapshot.frameTime).toBeLessThan(SIXTY_HZ_FRAME_MS + 0.5);
  });

  it('reports no frame rate before a full second of frames has been drawn', () => {
    const metrics = createRenderMetrics();
    let now = 0;
    for (let i = 0; i < 10; i++) {
      now += SIXTY_HZ_FRAME_MS;
      metrics.recordFrame(now, 3);
    }

    expect(metrics.snapshot().fps).toBe(0);
  });

  it('reports the draw calls of the latest frame', () => {
    const metrics = createRenderMetrics();
    metrics.recordFrame(0, 4);
    metrics.recordFrame(SIXTY_HZ_FRAME_MS, 9);

    expect(metrics.snapshot().drawCalls).toBe(9);
  });
});
