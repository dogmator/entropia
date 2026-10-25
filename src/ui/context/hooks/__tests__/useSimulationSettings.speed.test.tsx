import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { useEngineSync } from '../useEngineSync';
import { type SimulationLifecycle, useSimulationLifecycle } from '../useSimulationLifecycle';
import { useSimulationSettings } from '../useSimulationSettings';

let latest: SimulationLifecycle | null = null;
const listeners = new Set<() => void>();
const sentSpeeds: number[] = [];

const notifySubscribers = (): void => {
  for (const listener of listeners) listener();
};

const engine = {
  setSpeed: (speed: number) => { sentSpeeds.push(speed); notifySubscribers(); },
  pause: vi.fn(),
  resume: vi.fn(),
  init: vi.fn(() => new Promise<void>(() => undefined)),
  destroy: vi.fn(),
  setCameraData: vi.fn(),
} as unknown as ISimulationEngine;

const LogPanel = (): null => {
  const [, setEntries] = useState(0);
  useEffect(() => {
    const listener = (): void => { setEntries(count => count + 1); };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return null;
};

const Harness = () => {
  const settings = useSimulationSettings(engine);
  useEngineSync(engine, settings.speed, settings.worldScale);
  const lifecycle = useSimulationLifecycle({ engine, settings, resetHistory: () => undefined });
  useEffect(() => { latest = lifecycle; });
  return <LogPanel />;
};

describe('simulation speed updates with an active log subscriber', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    listeners.clear();
    sentSpeeds.length = 0;
    vi.clearAllMocks();
    latest = null;
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    listeners.clear();
    window.history.replaceState(null, '', '/');
  });

  it('does not update subscribed components during render on stop or resume', () => {
    const reactErrors: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      reactErrors.push(args.map(String).join(' '));
    });

    try {
      act(() => { root.render(<Harness />); });
      expect(sentSpeeds.at(-1)).toBe(1);

      act(() => { latest?.stopSimulation(); });
      expect(latest?.simulationState).toBe('stopped');
      expect(sentSpeeds.at(-1)).toBe(0);

      act(() => { latest?.runSimulation(); });
      expect(latest?.simulationState).toBe('running');
      expect(sentSpeeds.at(-1)).toBe(1);

      expect(reactErrors.filter(message => message.includes('Cannot update a component'))).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
