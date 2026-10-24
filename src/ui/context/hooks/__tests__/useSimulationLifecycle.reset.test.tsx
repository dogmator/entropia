 
import { act, type ReactElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { type SimulationLifecycle,useSimulationLifecycle } from '../useSimulationLifecycle';
import type { SimulationSettings } from '../useSimulationSettings';

const RUNNING_SPEED = 5;
const ERROR_ARCHIVE_KEY = 'entropia-errors';
const REMOTE_LOGGING_KEY = 'entropia:remoteLogging';
const BROWSER_STORAGE_KEYS = [ERROR_ARCHIVE_KEY, REMOTE_LOGGING_KEY] as const;

describe('useSimulationLifecycle — reset', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: SimulationLifecycle | null = null;

  const Probe = (props: { engine: ISimulationEngine; settings: SimulationSettings; resetHistory: () => void }): null => {
    const lifecycle = useSimulationLifecycle(props);
    useEffect(() => { latest = lifecycle; });
    return null;
  };

  const render = (element: ReactElement): void => {
    act(() => { root.render(element); });
  };

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
    const engine = {
      pause: vi.fn(() => { calls.push('pause'); }),
      reset: vi.fn(() => { calls.push('reset'); }),
    } as unknown as ISimulationEngine;
    const settings = { speed: RUNNING_SPEED, setSpeed: vi.fn() } as unknown as SimulationSettings;
    render(<Probe engine={engine} settings={settings} resetHistory={() => undefined} />);

    act(() => { latest?.onReset(); });

    expect(calls).toEqual(['pause', 'reset']);
    expect(settings.setSpeed).toHaveBeenCalled();
    expect(latest?.simulationState).toBe('paused');
  });

  it('leaves the error archive and the logging preference in browser storage', () => {
    localStorage.setItem(ERROR_ARCHIVE_KEY, '[]');
    localStorage.setItem(REMOTE_LOGGING_KEY, '1');
    const engine = { pause: vi.fn(), reset: vi.fn() } as unknown as ISimulationEngine;
    const settings = { speed: RUNNING_SPEED, setSpeed: vi.fn() } as unknown as SimulationSettings;
    render(<Probe engine={engine} settings={settings} resetHistory={() => undefined} />);

    act(() => { latest?.onReset(); });

    expect(localStorage.getItem(ERROR_ARCHIVE_KEY)).toBe('[]');
    expect(localStorage.getItem(REMOTE_LOGGING_KEY)).toBe('1');
  });
});
