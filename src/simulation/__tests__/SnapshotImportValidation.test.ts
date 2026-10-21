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

describe('snapshot import validation: genetic tree and counters', () => {
  it('rejects a genetic tree without roots without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    snapshot['geneticTree'] = { nodes: [] };

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/roots/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a genetic tree node without children without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    const nodes = (snapshot['geneticTree'] as Loose)['nodes'] as Loose[];
    const first = nodes[0];
    if (!first) throw new Error('precondition: the snapshot must contain genetic tree nodes');
    delete first['children'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/genetic tree node/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a missing id counter without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete (snapshot['counters'] as Loose)['organismIdCounter'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/organismIdCounter/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a non-finite death count without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    (snapshot['stats'] as Loose)['totalDeaths'] = Number.NaN;

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/totalDeaths/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });
});

// Returns the genome of the first organism of the given type, so a test can corrupt one kind of genome.
const genomeOf = (snapshot: Loose, type: string): Loose => {
  const genome = (snapshot['organisms'] as Loose[]).map(organism => organism['genome'] as Loose).find(g => g['type'] === type);
  if (!genome) throw new Error(`precondition: the snapshot must contain a ${type} genome`);
  return genome;
};

describe('snapshot import validation: organism genomes', () => {
  it('rejects an organism with an empty genome without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    const first = (snapshot['organisms'] as Loose[])[0];
    if (!first) throw new Error('precondition: the snapshot must contain organisms');
    first['genome'] = {};

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/genome/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a prey genome without a required trait without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete genomeOf(snapshot, 'PREY')['maxSpeed'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/maxSpeed/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a predator genome with an unknown subtype without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    genomeOf(snapshot, 'PREDATOR')['subtype'] = 'SCAVENGER';

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/subtype/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a genome with an unknown type without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    genomeOf(snapshot, 'PREY')['type'] = 'FOOD';

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/genome\.type/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });
});

describe('snapshot import validation: organism genome traits by type', () => {
  it('rejects a prey genome without flockingStrength without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete genomeOf(snapshot, 'PREY')['flockingStrength'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/flockingStrength/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a predator genome without attackPower without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete genomeOf(snapshot, 'PREDATOR')['attackPower'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/attackPower/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a predator genome without packAffinity without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete genomeOf(snapshot, 'PREDATOR')['packAffinity'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/packAffinity/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });
});

describe('snapshot import validation: organism genome identity', () => {
  it('rejects a genome without an id without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    delete genomeOf(snapshot, 'PREY')['id'];

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/genome\.id/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });

  it('rejects a genome whose parentId is neither null nor a string without changing the active engine', () => {
    const engine = createActiveEngine();
    const before = JSON.stringify(engine.exportState());
    const snapshot = asLoose(createSnapshot());
    genomeOf(snapshot, 'PREY')['parentId'] = 7;

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).toThrow(/parentId/);
    expect(JSON.stringify(engine.exportState())).toBe(before);
  });
});

describe('snapshot import compatibility', () => {
  it('imports a snapshot written before lastBiteTick existed and keeps every genome unchanged', () => {
    const engine = createActiveEngine();
    const snapshot = asLoose(createSnapshot());
    for (const food of snapshot['food'] as Loose[]) delete food['lastBiteTick'];
    const legacy = JSON.parse(JSON.stringify(snapshot)) as SerializedSimulationStateV1;
    const genomesBefore = JSON.stringify(legacy.organisms.map(organism => organism.genome));

    expect(() => { engine.importState(legacy); }).not.toThrow();
    expect(JSON.stringify(engine.exportState().organisms.map(organism => organism.genome))).toBe(genomesBefore);
  });

  it('accepts prey genomes without predator fields and predator genomes without prey fields', () => {
    const engine = createActiveEngine();
    const snapshot = asLoose(createSnapshot());
    expect(genomeOf(snapshot, 'PREY')).not.toHaveProperty('subtype');
    expect(genomeOf(snapshot, 'PREDATOR')).not.toHaveProperty('flockingStrength');

    expect(() => { engine.importState(snapshot as unknown as SerializedSimulationStateV1); }).not.toThrow();
  });
});
