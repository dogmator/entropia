/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// A restored run must match the uninterrupted run, so the snapshot has to carry every input that shapes later ticks:
// the runtime configuration, the failsafe counters and the historical maxima. Each test moves one of those away from
// its default, so a restore that drops it cannot pass by accident.

const SEED = 4242;
const RESTORE_SEED = 99;
const CHECKPOINT = 30;
const HORIZON = 40;
// Mirrors RESOURCE_FAILSAFE_TICKS in TickLoop.service.ts. The counter is set near the threshold so the test stays short.
const RESOURCE_FAILSAFE_TICKS = 600;
const FAILSAFE_TICKS_LEFT = 5;

interface TickLoopCounters { zeroPopulationTicks: number; zeroFoodTicks: number }

const failsafeCounters = (engine: SimulationEngine): TickLoopCounters =>
  (engine as unknown as { tickLoop: TickLoopCounters }).tickLoop;

const roundTrip = (state: SerializedSimulationStateV1): SerializedSimulationStateV1 =>
  JSON.parse(JSON.stringify(state)) as SerializedSimulationStateV1;

// spawnTime is wall-clock metadata that no simulation logic reads, so it is excluded from comparisons.
const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const firstDivergentTick = (uninterrupted: SimulationEngine, restored: SimulationEngine, horizon: number): number | null => {
  for (let i = 0; i < horizon; i++) {
    uninterrupted.update();
    restored.update();
    if (comparable(restored) !== comparable(uninterrupted)) return uninterrupted.getTick();
  }
  return null;
};

describe('snapshot restore: runtime configuration', () => {
  it('restores the configuration that was changed at runtime and continues like the uninterrupted run', () => {
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    Object.assign(source.config, { mutationFactor: 0.37, maxFood: 77, foodSpawnRate: 0.11 });
    for (let i = 0; i < CHECKPOINT; i++) source.update();

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(roundTrip(source.exportState()));
    restored.start();

    expect(restored.config).toEqual(source.config);
    expect(firstDivergentTick(source, restored, HORIZON)).toBeNull();
  });

  it('rejects a snapshot with a non-finite numeric configuration value without changing the active engine', () => {
    const engine = new SimulationEngine(1, { seed: RESTORE_SEED });
    engine.start();
    for (let i = 0; i < CHECKPOINT; i++) engine.update();
    const before = comparable(engine);

    const source = new SimulationEngine(1, { seed: SEED });
    const broken = structuredClone(source.exportState()) as unknown as { config: Record<string, unknown> };
    broken.config['mutationFactor'] = Number.NaN;

    expect(() => { engine.importState(broken as unknown as SerializedSimulationStateV1); }).toThrow(/mutationFactor/);
    expect(comparable(engine)).toBe(before);
  });

  it('rejects a snapshot whose boolean setting holds a value of another type, because it would stay truthy or falsy wrongly', () => {
    const engine = new SimulationEngine(1, { seed: RESTORE_SEED });
    const before = comparable(engine);
    const source = new SimulationEngine(1, { seed: SEED });
    const broken = structuredClone(source.exportState()) as unknown as { config: Record<string, unknown> };
    broken.config['showObstacles'] = 'false';

    expect(() => { engine.importState(broken as unknown as SerializedSimulationStateV1); }).toThrow(/showObstacles/);
    expect(comparable(engine)).toBe(before);
  });

  it('rejects a snapshot whose graphics quality is not one of the presets the settings UI knows', () => {
    const engine = new SimulationEngine(1, { seed: RESTORE_SEED });
    const before = comparable(engine);
    const source = new SimulationEngine(1, { seed: SEED });
    const broken = structuredClone(source.exportState()) as unknown as { config: Record<string, unknown> };
    broken.config['graphicsQuality'] = 'NOT_A_PRESET';

    expect(() => { engine.importState(broken as unknown as SerializedSimulationStateV1); }).toThrow(/graphicsQuality/);
    expect(comparable(engine)).toBe(before);
  });
});

describe('snapshot restore: failsafe counters', () => {
  it('restores the food failsafe counter so the failsafe fires on the uninterrupted schedule', () => {
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    for (let i = 0; i < CHECKPOINT; i++) source.update();
    // With no food and spawn rate 0, every tick still draws one random number while food is below maxFood.
    // The failsafe adds one more draw when it fires, so the random stream exposes the firing tick.
    Object.assign(source.config, { maxFood: 50, foodSpawnRate: 0 });
    source.food.clear();
    failsafeCounters(source).zeroFoodTicks = RESOURCE_FAILSAFE_TICKS - FAILSAFE_TICKS_LEFT;

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(roundTrip(source.exportState()));
    restored.start();

    expect(firstDivergentTick(source, restored, FAILSAFE_TICKS_LEFT + 5)).toBeNull();
    expect(failsafeCounters(restored).zeroFoodTicks).toBe(failsafeCounters(source).zeroFoodTicks);
  });

  it('keeps the snapshot readable when the failsafe counters are absent from a legacy snapshot', () => {
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    for (let i = 0; i < CHECKPOINT; i++) source.update();
    const legacy = roundTrip(source.exportState()) as Partial<SerializedSimulationStateV1>;
    delete legacy.failsafe;

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    expect(() => { restored.importState(legacy as SerializedSimulationStateV1); }).not.toThrow();
    expect(failsafeCounters(restored).zeroFoodTicks).toBe(0);
    expect(failsafeCounters(restored).zeroPopulationTicks).toBe(0);
  });
});

describe('snapshot restore: historical maxima', () => {
  it('restores the historical maximum age and generation rather than recomputing them from living organisms', () => {
    const source = new SimulationEngine(1, { seed: SEED });
    source.start();
    for (let i = 0; i < CHECKPOINT; i++) source.update();
    const snapshot = roundTrip(source.exportState());
    // The maxima are cumulative. An organism that already died keeps them, so they can exceed every living organism.
    const HISTORICAL_MAX_AGE = snapshot.stats.maxAge + 1000;
    const HISTORICAL_MAX_GENERATION = snapshot.stats.maxGeneration + 7;
    snapshot.stats.maxAge = HISTORICAL_MAX_AGE;
    snapshot.stats.maxGeneration = HISTORICAL_MAX_GENERATION;

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(snapshot);

    expect(restored.exportState().stats).toMatchObject({ maxAge: HISTORICAL_MAX_AGE, maxGeneration: HISTORICAL_MAX_GENERATION });
  });
});

describe('snapshot restore: world scale and setting limits', () => {
  const OTHER_SCALE = 2;

  const brokenConfigOf = (snapshot: SerializedSimulationStateV1): { config: Record<string, unknown> } =>
    structuredClone(snapshot) as unknown as { config: Record<string, unknown> };

  it('records the world scale and rejects a snapshot saved at another scale without changing the engine', () => {
    const snapshot = roundTrip(new SimulationEngine(1, { seed: SEED }).exportState());
    expect(snapshot.worldScale).toBe(1);

    const target = new SimulationEngine(OTHER_SCALE, { seed: RESTORE_SEED });
    const before = comparable(target);

    expect(() => { target.importState(snapshot); }).toThrow(/saved at world scale 1, but this world runs at 2/);
    expect(comparable(target)).toBe(before);
  });

  it('imports a legacy snapshot without a world scale at the live scale', () => {
    const legacy = roundTrip(new SimulationEngine(1, { seed: SEED }).exportState()) as Partial<SerializedSimulationStateV1>;
    delete legacy.worldScale;

    const restored = new SimulationEngine(OTHER_SCALE, { seed: RESTORE_SEED });
    expect(() => { restored.importState(legacy as SerializedSimulationStateV1); }).not.toThrow();
  });

  it('rejects a negative population limit, which would stop reproduction, without changing the engine', () => {
    const engine = new SimulationEngine(1, { seed: RESTORE_SEED });
    const before = comparable(engine);
    const broken = brokenConfigOf(new SimulationEngine(1, { seed: SEED }).exportState());
    broken.config['maxOrganisms'] = -1;

    expect(() => { engine.importState(broken as unknown as SerializedSimulationStateV1); }).toThrow(/maxOrganisms must not be negative/);
    expect(comparable(engine)).toBe(before);
  });

  it('rejects a drag outside (0, 1], which would reverse or amplify motion', () => {
    const engine = new SimulationEngine(1, { seed: RESTORE_SEED });
    const before = comparable(engine);
    const broken = brokenConfigOf(new SimulationEngine(1, { seed: SEED }).exportState());
    broken.config['drag'] = 1.5;

    expect(() => { engine.importState(broken as unknown as SerializedSimulationStateV1); }).toThrow(/drag must be above 0 and at most 1/);
    expect(comparable(engine)).toBe(before);
  });
});
