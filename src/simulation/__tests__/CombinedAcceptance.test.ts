/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { FOOD_ENERGY_VALUE, RESOURCE_STOCK_UNITS_PER_FOOD } from '@/config';
import { alterNewestCheckpoint } from '@/core/persistence/__tests__/checkpointTestUtils';
import type { CheckpointEngine } from '@/core/persistence/CheckpointController.service';
import { CheckpointController } from '@/core/persistence/CheckpointController.service';
import type { CheckpointInput } from '@/core/persistence/CheckpointStore.service';
import { CheckpointStore } from '@/core/persistence/CheckpointStore.service';
import type { SerializedSimulationStateV1 } from '@/types';
import { EngineState } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Stage M acceptance: the batch's G (async snapshots), H (IndexedDB checkpoints), I (genealogy) and J (resource stock)
// exercised together. Every case is bounded: fixed seeds, fixed checkpoint positions and a short continuation. Long
// runs are measured by the env-gated report in CombinedEnduranceReport.test.ts, so the regular suite stays quick.
const PRIMARY_SEED = 4242;
const SEEDS = [PRIMARY_SEED, 1];
const SHORT_CHECKPOINT = 60;
const MEDIUM_CHECKPOINT = 150;
const CONTINUATION_TICKS = 40;
const EXTINCTION_TICKS = 300;
const RESTORE_SEED = 99;
const LONG_RUN_TIMEOUT_MS = 180_000;
const LEDGER_TOLERANCE = 1e-9;

const roundTrip = (state: SerializedSimulationStateV1): SerializedSimulationStateV1 =>
  JSON.parse(JSON.stringify(state)) as SerializedSimulationStateV1;

// The state with its wall-clock metadata removed, so two runs can be compared.
const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const worldOf = (seed: number, resourceStock: boolean): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed, resourceStock });
  engine.start();
  return engine;
};

const advance = (engine: SimulationEngine, ticks: number): void => {
  for (let tick = 0; tick < ticks; tick++) engine.update();
};

// Restores a snapshot into a fresh engine. The engine is started, as a loaded world is when the user resumes it.
const restoreInto = (snapshot: SerializedSimulationStateV1): SimulationEngine => {
  const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
  restored.importState(snapshot);
  restored.start();
  return restored;
};

// Runs both worlds for the horizon and returns the tick where they first differ, or null when they never do.
const firstDivergentTick = (reference: SimulationEngine, restored: SimulationEngine, ticks: number): number | null => {
  for (let tick = 0; tick < ticks; tick++) {
    reference.update();
    restored.update();
    if (comparable(restored) !== comparable(reference)) return reference.getTick();
  }
  return null;
};

const adaptEngine = (engine: SimulationEngine): CheckpointEngine => ({
  exportState: () => Promise.resolve(engine.exportState()),
  importState: (state: SerializedSimulationStateV1) => Promise.resolve().then(() => { engine.importState(state); }),
});

const controllerFor = (engine: SimulationEngine, store: CheckpointStore): CheckpointController =>
  new CheckpointController({
    worldId: 'default',
    engine: adaptEngine(engine),
    store,
    acquireLock: () => Promise.resolve('granted'),
    now: () => 1,
  });

// A store that refuses its first write, as a full quota does, and accepts every write after that.
class RefusingOnceStore extends CheckpointStore {
  private refusalsLeft = 1;

  public override async commit(input: CheckpointInput): Promise<number> {
    if (this.refusalsLeft > 0) {
      this.refusalsLeft--;
      throw new Error('QuotaExceededError: the browser refused the write');
    }
    return super.commit(input);
  }
}

describe('combined acceptance: restore continuation in both ecologies', () => {
  for (const isStockOn of [false, true]) {
    const ecology = isStockOn ? 'resource stock on' : 'default ecology';
    for (const seed of SEEDS) {
      for (const checkpoint of [SHORT_CHECKPOINT, MEDIUM_CHECKPOINT]) {
        it(`${ecology}, seed ${String(seed)}: a save at tick ${String(checkpoint)} restores and continues like the uninterrupted run`, () => {
          const source = worldOf(seed, isStockOn);
          advance(source, checkpoint);
          const restored = restoreInto(roundTrip(source.exportState()));

          expect(restored.resourceStock.isEnabled).toBe(isStockOn);
          expect(firstDivergentTick(source, restored, CONTINUATION_TICKS)).toBeNull();
        }, LONG_RUN_TIMEOUT_MS);
      }
    }
  }
});

describe('combined acceptance: genealogy and energy accounting', () => {
  for (const isStockOn of [false, true]) {
    const ecology = isStockOn ? 'resource stock on' : 'default ecology';
    it(`${ecology}: after a restore the genealogy keeps one node per birth on top of the founders`, () => {
      const source = worldOf(PRIMARY_SEED, isStockOn);
      advance(source, MEDIUM_CHECKPOINT);
      const restored = restoreInto(roundTrip(source.exportState()));
      advance(restored, CONTINUATION_TICKS);

      expect(restored.geneticTree.size).toBe(restored.geneticRoots.length + restored.getStats().totalBirths);
      expect(restored.geneticRoots).toEqual(source.geneticRoots);
    }, LONG_RUN_TIMEOUT_MS);
  }

  it('resource stock on: after a restore every unit paid and every joule of food is accounted for', () => {
    const source = worldOf(PRIMARY_SEED, true);
    advance(source, MEDIUM_CHECKPOINT);
    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(roundTrip(source.exportState()));
    restored.start();
    advance(restored, CONTINUATION_TICKS * 5);

    // The ledger counts from the restore. The food the snapshot brought in is its opening balance.
    const ledger = restored.getResourceLedger();
    const paid = (ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD) * FOOD_ENERGY_VALUE;
    const accounted = ledger.energyAbsorbed + ledger.energyDiscarded + ledger.energyRemoved + ledger.foodEnergyRemaining;
    expect(ledger.unitsSpent).toBeGreaterThan(0);
    expect(ledger.openingFoodEnergy).toBeGreaterThan(0);
    expect(Math.abs(paid + ledger.openingFoodEnergy - accounted)).toBeLessThanOrEqual(LEDGER_TOLERANCE * Math.max(1, accounted));
  }, LONG_RUN_TIMEOUT_MS);

  it('an extinct stock world restored from its snapshot stays empty and paused, and no birth brings it back', () => {
    const source = worldOf(PRIMARY_SEED, true);
    for (let tick = 0; tick < EXTINCTION_TICKS; tick++) {
      for (const organism of source.organisms.values()) organism.energy = 0;
      source.update();
    }
    expect(source.state).toBe(EngineState.PAUSED);
    expect(source.organisms.size).toBe(0);
    const birthsBefore = source.getStats().totalBirths;

    const restored = restoreInto(roundTrip(source.exportState()));
    restored.update();

    expect(restored.organisms.size).toBe(0);
    expect(restored.getStats().totalBirths).toBe(birthsBefore);
    expect(restored.state).toBe(EngineState.PAUSED);
  }, LONG_RUN_TIMEOUT_MS);
});

describe('combined acceptance: IndexedDB corruption and failure', () => {
  it('a stock world whose newest checkpoint was altered restores the previous one, and continues from that tick', async () => {
    const factory = new FakeIDBFactory();
    const store = new CheckpointStore(factory);
    const source = worldOf(PRIMARY_SEED, true);
    advance(source, SHORT_CHECKPOINT);
    const writer = controllerFor(source, store);
    await writer.start();
    await writer.save();
    advance(source, MEDIUM_CHECKPOINT - SHORT_CHECKPOINT);
    await writer.save();
    await alterNewestCheckpoint(factory, payload => `${payload} `);

    const reference = worldOf(PRIMARY_SEED, true);
    advance(reference, SHORT_CHECKPOINT);
    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    const loader = controllerFor(restored, store);
    await loader.start();
    await loader.restore();
    restored.start();

    const status = loader.getStatus();
    expect(status).toMatchObject({ kind: 'restored', tick: SHORT_CHECKPOINT });
    expect(status.kind === 'restored' && status.skipped).toHaveLength(1);
    expect(restored.resourceStock.isEnabled).toBe(true);
    expect(firstDivergentTick(reference, restored, CONTINUATION_TICKS)).toBeNull();
  }, LONG_RUN_TIMEOUT_MS);

  it('a save the store refuses leaves the live stock world unchanged, and the next save restores normally', async () => {
    const factory = new FakeIDBFactory();
    const store = new RefusingOnceStore(factory);
    const source = worldOf(PRIMARY_SEED, true);
    const reference = worldOf(PRIMARY_SEED, true);
    advance(source, SHORT_CHECKPOINT);
    advance(reference, SHORT_CHECKPOINT);
    const writer = controllerFor(source, store);
    await writer.start();

    await writer.save();
    expect(writer.getStatus()).toMatchObject({ kind: 'failed', action: 'save' });
    expect(comparable(source)).toBe(comparable(reference));

    const EXTRA_TICKS = 10;
    advance(source, EXTRA_TICKS);
    advance(reference, EXTRA_TICKS);
    await writer.save();
    expect(writer.getStatus()).toMatchObject({ kind: 'saved', tick: SHORT_CHECKPOINT + EXTRA_TICKS });

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    const loader = controllerFor(restored, store);
    await loader.start();
    await loader.restore();
    restored.start();

    expect(loader.getStatus()).toMatchObject({ kind: 'restored', tick: SHORT_CHECKPOINT + EXTRA_TICKS });
    expect(firstDivergentTick(source, restored, CONTINUATION_TICKS)).toBeNull();
  }, LONG_RUN_TIMEOUT_MS);
});
