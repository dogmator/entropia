import { describe, expect, it } from 'vitest';

import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { SimulationConfig } from '@/types';

import { initialConfigFor } from '../useSettingsState';

const engineWith = (config: Partial<SimulationConfig>): ISimulationEngine =>
  ({ config: config as SimulationConfig }) as unknown as ISimulationEngine;

describe('settings panel: initial configuration', () => {
  it('a panel that replaces an earlier one takes the live configuration, as a copy, so the URL is not replayed', () => {
    const engine = engineWith({ maxFood: 123, mutationFactor: 0.2 });

    const initial = initialConfigFor(engine, 'engine');

    expect(initial).toEqual({ maxFood: 123, mutationFactor: 0.2 });
    expect(initial).not.toBe(engine.config);
  });
});
