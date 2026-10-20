import { describe, expect, it } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { SimulationEngine } from '../engine/Engine';

const CHECK = 50;
const SEED_SOURCE = 4242;
const SEED_ACTIVE = 99;

const createSnapshot = (): SerializedSimulationStateV1 => {
  const source = new SimulationEngine(1, { seed: SEED_SOURCE });
  source.start();
  for (let i = 0; i < CHECK; i++) source.update();
  return source.exportState();
};

const createActiveEngine = (): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed: SEED_ACTIVE });
  engine.start();
  for (let i = 0; i < CHECK; i++) engine.update();
  return engine;
};

// Loose record type for building deliberately malformed snapshots.
type Loose = Record<string, unknown>;
const asLoose = (state: SerializedSimulationStateV1): Loose => structuredClone(state) as unknown as Loose;

describe('snapshot import validation', () => {
  it('rejects an unsupported snapshot version without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = { ...asLoose(createSnapshot()), version: 2 } as unknown as SerializedSimulationStateV1;

    expect(() => { engine.importState(snapshot); }).toThrow(/version/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a snapshot with a missing collection without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete snapshot['organisms'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/organisms/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a malformed organism before any collection is replaced', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    const organisms = snapshot['organisms'] as Loose[];
    const first = organisms[0];
    if (!first) throw new Error('precondition: the snapshot must contain organisms');
    first['position'] = { x: 'not a number', y: 0, z: 0 };

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/organism/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a non-finite seed without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = { ...asLoose(createSnapshot()), seed: Number.NaN } as unknown as SerializedSimulationStateV1;

    expect(() => { engine.importState(snapshot); }).toThrow(/seed/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });
});
