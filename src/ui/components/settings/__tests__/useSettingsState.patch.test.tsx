 
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GRAPHICS_PRESETS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { SimulationConfig } from '@/types';

import { type SettingsState, useSettingsState } from '../useSettingsState';

// The keys of the presets are included, so that a preset can be applied to this configuration.
const CONFIG = { ...GRAPHICS_PRESETS.LOW, maxFood: 400, showTrails: true, graphicsQuality: 'LOW' } as unknown as SimulationConfig;
const CHANGED_MAX_FOOD = 350;

const byName = (a: string, b: string): number => a.localeCompare(b);

describe('useSettingsState — a change sends only the settings it touches', () => {
  let container: HTMLDivElement;
  let root: Root;
  let panel: SettingsState | null = null;
  let updateConfig: ReturnType<typeof vi.fn>;

  const Probe = ({ engine }: { engine: ISimulationEngine }): null => {
    const settings = useSettingsState(engine, 'engine');
    useEffect(() => { panel = settings; });
    return null;
  };

  const mounted = (): SettingsState => {
    if (!panel) throw new Error('the settings panel is not mounted');
    return panel;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    updateConfig = vi.fn();
    const engine = { config: { ...CONFIG }, updateConfig } as unknown as ISimulationEngine;
    act(() => { root.render(<Probe engine={engine} />); });
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    panel = null;
    vi.restoreAllMocks();
  });

  it('update sends the changed setting and the quality mark, and nothing else', () => {
    act(() => { mounted().update('maxFood', CHANGED_MAX_FOOD); });

    expect(updateConfig).toHaveBeenCalledWith({ maxFood: CHANGED_MAX_FOOD, graphicsQuality: 'CUSTOM' });
  });

  it('toggle sends the changed setting and the quality mark, and nothing else', () => {
    act(() => { mounted().toggle('showTrails'); });

    expect(updateConfig).toHaveBeenCalledWith({ showTrails: false, graphicsQuality: 'CUSTOM' });
  });

  it('a graphics preset sends the preset values and its quality, and nothing else', () => {
    act(() => { mounted().applyPreset('HIGH'); });

    const sent = updateConfig.mock.lastCall?.[0] as Partial<SimulationConfig> | undefined;
    expect(Object.keys(sent ?? {}).sort(byName)).toEqual(Object.keys(GRAPHICS_PRESETS.HIGH).sort(byName));
    expect(sent).toMatchObject({ graphicsQuality: 'HIGH' });
  });
});
