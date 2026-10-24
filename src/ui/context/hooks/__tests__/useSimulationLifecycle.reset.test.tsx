/* eslint-disable max-lines-per-function */
import { act, type ReactElement, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { type SimulationLifecycle, useSimulationLifecycle } from '../useSimulationLifecycle';
import type { SimulationSettings } from '../useSimulationSettings';

const RUNNING_SPEED = 5;
const ERROR_ARCHIVE_KEY = 'entropia-errors';
const REMOTE_LOGGING_KEY = 'entropia:remoteLogging';
const BROWSER_STORAGE_KEYS = [ERROR_ARCHIVE_KEY, REMOTE_LOGGING_KEY] as const;

describe('useSimulationLifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: SimulationLifecycle | null = null;

  // The speed lives in React state, as it does in the settings, so a change of speed reaches the hook on the next render.
  const Harness = (props: { engine: ISimulationEngine }): null => {
    const [speed, setSpeed] = useState(RUNNING_SPEED);
    const settings = { speed, setSpeed } as unknown as SimulationSettings;
    const lifecycle = useSimulationLifecycle({ engine: props.engine, settings, resetHistory: () => undefined });
    useEffect(() => { latest = lifecycle; });
    return null;
  };

  const render = (element: ReactElement): void => {
    act(() => { root.render(element); });
  };

  const fakeEngine = (calls: string[] = []): ISimulationEngine => ({
    pause: vi.fn(() => { calls.push('pause'); }),
    reset: vi.fn(() => { calls.push('reset'); }),
  }) as unknown as ISimulationEngine;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    for (const key of BROWSER_STORAGE_KEYS) localStorage.removeItem(key);
  });

  it('pauses the engine before resetting it, so the reset cannot advance the new world', () => {
    const calls: string[] = [];
    render(<Harness engine={fakeEngine(calls)} />);

    act(() => { latest?.onReset(); });

    expect(calls).toEqual(['pause', 'reset']);
    expect(latest?.simulationState).toBe('paused');
  });

  it('shows a stop as a stop, not as a pause', () => {
    const calls: string[] = [];
    render(<Harness engine={fakeEngine(calls)} />);

    act(() => { latest?.stopSimulation(); });

    expect(calls).toEqual(['pause']);
    expect(latest?.simulationState).toBe('stopped');
  });

  it('starts a stopped world again when it is run', () => {
    render(<Harness engine={fakeEngine()} />);
    act(() => { latest?.stopSimulation(); });

    act(() => { latest?.runSimulation(); });

    expect(latest?.simulationState).toBe('running');
  });

  it('leaves the error archive and the logging preference in browser storage', () => {
    localStorage.setItem(ERROR_ARCHIVE_KEY, '[]');
    localStorage.setItem(REMOTE_LOGGING_KEY, '1');
    render(<Harness engine={fakeEngine()} />);

    act(() => { latest?.onReset(); });

    expect(localStorage.getItem(ERROR_ARCHIVE_KEY)).toBe('[]');
    expect(localStorage.getItem(REMOTE_LOGGING_KEY)).toBe('1');
  });
});
