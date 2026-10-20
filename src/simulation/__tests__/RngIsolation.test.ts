import { describe, expect, it } from 'vitest';

import { SimulationEngine } from '../engine/Engine';

// Engines in one JavaScript realm must not influence each other's random sequences. Every test compares an engine
// that runs alongside others with the same engine run alone. Equality with the solo run is the invariant.
const TICKS = 120;
const HALF_TICKS = 60;
const FIRST_BURST = 7;
const SECOND_BURST = 3;

const SEED_A = 4242;
const SEED_B = 99;
const SEED_C = 1;
const SEED_D = 2;
const SEED_E = 0xdeadbeef;
const SEED_F = 0x12345678;
const SEED_PAIRS: readonly (readonly [number, number])[] = [
  [SEED_A, SEED_B],
  [SEED_C, SEED_D],
  [SEED_E, SEED_F],
];

// Food.spawnTime is wall-clock metadata that no simulation logic reads. Excluding it lets the test compare dynamics.
const WALL_CLOCK_METADATA_KEYS = new Set(['spawnTime']);
const serialize = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (WALL_CLOCK_METADATA_KEYS.has(key) ? undefined : value));

const createStarted = (seed: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  return engine;
};

const advance = (engine: SimulationEngine, ticks: number): void => {
  for (let i = 0; i < ticks; i++) engine.update();
};

const runAlone = (seed: number): string => {
  const engine = createStarted(seed);
  advance(engine, TICKS);
  return serialize(engine);
};

describe('RNG isolation: construction and reset', () => {
  it.each(SEED_PAIRS)('seed %i is unaffected by an engine created mid-run with seed %i', (seed, other) => {
    const expected = runAlone(seed);

    const engine = createStarted(seed);
    advance(engine, HALF_TICKS);
    // Constructing and running a second engine must not reset or advance the first engine's random stream.
    const intruder = createStarted(other);
    advance(intruder, HALF_TICKS);
    advance(engine, TICKS - HALF_TICKS);

    expect(serialize(engine)).toBe(expected);
  });

  it('a reset or re-seed of one engine does not change another engine\'s sequence', () => {
    const expected = runAlone(SEED_A);

    const engine = createStarted(SEED_A);
    advance(engine, HALF_TICKS);
    const bystander = createStarted(SEED_B);
    bystander.reset();
    bystander.setSeed(SEED_B + 1);
    advance(engine, TICKS - HALF_TICKS);

    expect(serialize(engine)).toBe(expected);
  });
});

describe('RNG isolation: interleaved advancement', () => {
  it.each(SEED_PAIRS)('seeds %i and %i each match their solo run under strict alternation', (seedA, seedB) => {
    const expectedA = runAlone(seedA);
    const expectedB = runAlone(seedB);

    const engineA = createStarted(seedA);
    const engineB = createStarted(seedB);
    for (let i = 0; i < TICKS; i++) {
      engineA.update();
      engineB.update();
    }

    expect(serialize(engineA)).toBe(expectedA);
    expect(serialize(engineB)).toBe(expectedB);
  });

  it.each(SEED_PAIRS)('seeds %i and %i each match their solo run under bursty interleaving', (seedA, seedB) => {
    const expectedA = runAlone(seedA);
    const expectedB = runAlone(seedB);

    const engineA = createStarted(seedA);
    const engineB = createStarted(seedB);
    // The two engines advance in bursts of different sizes, so one can run ahead of the other.
    let remainingA = TICKS;
    let remainingB = TICKS;
    while (remainingA > 0 || remainingB > 0) {
      const stepA = Math.min(FIRST_BURST, remainingA);
      advance(engineA, stepA);
      remainingA -= stepA;
      const stepB = Math.min(SECOND_BURST, remainingB);
      advance(engineB, stepB);
      remainingB -= stepB;
    }

    expect(serialize(engineA)).toBe(expectedA);
    expect(serialize(engineB)).toBe(expectedB);
  });
});
