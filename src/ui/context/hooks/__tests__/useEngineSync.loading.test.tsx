 
/* eslint-disable max-lines-per-function */
import { act, type ReactElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { useEngineSync } from '../useEngineSync';
import { useSimulationLifecycle } from '../useSimulationLifecycle';
import type { SimulationSettings } from '../useSimulationSettings';

const SLOW_INIT_MS = 2000;
const PAST_OLD_FORCED_HIDE_MS = 1000;

interface Probe { isLoading: boolean }

const fakeSettings = { speed: 1, setSpeed: vi.fn() } as unknown as SimulationSettings;

const createFakeEngine = (initDurationMs: number): ISimulationEngine => {
  const engine = {
    init: vi.fn(() => new Promise<void>((resolve) => { setTimeout(resolve, initDurationMs); })),
    destroy: vi.fn(),
    setSpeed: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setCameraData: vi.fn(),
  };
  return engine as unknown as ISimulationEngine;
};

describe('useEngineSync — loader gating', () => {
  let container: HTMLDivElement;
  let root: Root;
  const observed: Probe = { isLoading: true };

  // Composes the same hooks as SimulationProvider: the loader flag comes from useEngineSync,
  // and useSimulationLifecycle runs next to it.
  const Probe = ({ engine }: { engine: ISimulationEngine }): null => {
    const sync = useEngineSync(engine, 1, 1);
    useSimulationLifecycle({ engine, settings: fakeSettings, resetHistory: () => undefined });
    useEffect(() => { observed.isLoading = sync.isLoading; });
    return null;
  };

  const render = (element: ReactElement): void => {
    act(() => { root.render(element); });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.useRealTimers();
  });

  it('keeps the loader visible past the minimum time while the engine is still initialising', async () => {
    const engine = createFakeEngine(SLOW_INIT_MS);

    render(<Probe engine={engine} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(PAST_OLD_FORCED_HIDE_MS); });

    expect(observed.isLoading).toBe(true);
  });

  it('hides the loader once initialisation completes, even after the minimum time has passed', async () => {
    const engine = createFakeEngine(SLOW_INIT_MS);

    render(<Probe engine={engine} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_INIT_MS + 1); });

    expect(observed.isLoading).toBe(false);
  });

  it('hides the loader as soon as an instant initialisation completes', async () => {
    const engine = createFakeEngine(0);

    render(<Probe engine={engine} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(observed.isLoading).toBe(false);
  });

  it('hides the loader when initialisation fails, so the error state can be shown', async () => {
    const engine = {
      ...createFakeEngine(0),
      init: vi.fn(() => Promise.reject(new Error('boom'))),
    } as unknown as ISimulationEngine;

    render(<Probe engine={engine} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(observed.isLoading).toBe(false);
  });
});
