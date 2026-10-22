/* eslint-disable @typescript-eslint/no-magic-numbers */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FOOD_ENERGY_VALUE, RESOURCE_STOCK_UNITS_PER_FOOD } from '@/config';
import type { SerializedSimulationStateV1 } from '@/types';
import { EngineState } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Measurement for the combined branch (stage M): long fixed-seed runs in both ecologies. Counts repeat for a fixed seed.
// Timing is machine-dependent and reported only. The stored payload is the JSON the checkpoint store writes for each
// save, so its size is what IndexedDB holds per checkpoint; the store keeps two checkpoints per world.
// COMBINED_REPORT=1 writes the table to COMBINED_REPORT_PATH. The report is outside the regular suite, because it takes minutes.
const SEEDS = [4242, 1, 3735928559, 7, 2024, 99];
const CHECKPOINTS = [100, 300, 900, 1500];
const isReportEnabled = process.env['COMBINED_REPORT'] === '1';
const REPORT_PATH = process.env['COMBINED_REPORT_PATH'];
const REPORT_TIMEOUT_MS = 900_000;
const LONG_CHECKPOINT = 900;
const CONTINUATION_TICKS = 40;
const RESTORE_SEED = 99;
const CONTINUATION_SEEDS = [4242, 1];
const COLUMNS = [
  'mode', 'seed', 'tick', 'extinct', 'organisms', 'food',
  'zoneStockMin', 'ledgerResidual', 'openingFoodEnergy',
  'genealogyNodes', 'genealogyBytes', 'snapshotBytes', 'storedPayloadBytes', 'msPerTick',
];

interface WorldRun {
  readonly seed: number;
  readonly isStockOn: boolean;
}

// The state with its wall-clock metadata removed, so two runs can be compared.
const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

// Saves a world at the long checkpoint, restores the save into a fresh engine, and runs both for the continuation.
// Returns the first tick where they differ, or null when they never do.
const continuationDivergence = (seed: number, isStockOn: boolean): number | null => {
  const source = new SimulationEngine(1, { seed, resourceStock: isStockOn });
  source.start();
  while (source.getTick() < LONG_CHECKPOINT && source.state === EngineState.RUNNING) source.update();
  const snapshot = JSON.parse(JSON.stringify(source.exportState())) as SerializedSimulationStateV1;
  const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
  restored.importState(snapshot);
  restored.start();
  for (let tick = 0; tick < CONTINUATION_TICKS; tick++) {
    source.update();
    restored.update();
    if (comparable(restored) !== comparable(source)) return source.getTick();
  }
  return null;
};

// Whole numbers stay whole, other numbers keep six decimals, and a missing number is an empty cell.
const format = (value: number | string): string => {
  if (typeof value === 'string') return value;
  if (Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
};

const rowOf = (engine: SimulationEngine, run: WorldRun, msPerTick: number): string => {
  const snapshot = engine.exportState();
  const stats = engine.getStats();
  const ledger = engine.getResourceLedger();
  const stocks = Array.from(engine.zones.keys(), id => engine.resourceStock.stockOf(id));
  const accounted = ledger.energyAbsorbed + ledger.energyDiscarded + ledger.energyRemoved + ledger.foodEnergyRemaining;
  const paid = (ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD) * FOOD_ENERGY_VALUE;
  const values: (number | string)[] = [
    run.isStockOn ? 'on' : 'off', run.seed, engine.getTick(), engine.state === EngineState.RUNNING ? 0 : 1,
    engine.organisms.size, stats.foodCount,
    run.isStockOn ? Math.min(...stocks) : Number.NaN,
    run.isStockOn ? paid + ledger.openingFoodEnergy - accounted : Number.NaN,
    run.isStockOn ? ledger.openingFoodEnergy : Number.NaN,
    engine.geneticTree.size,
    new TextEncoder().encode(JSON.stringify(snapshot.geneticTree)).byteLength,
    new TextEncoder().encode(JSON.stringify(snapshot)).byteLength,
    new TextEncoder().encode(JSON.stringify(engine.exportState())).byteLength,
    msPerTick,
  ];
  return values.map(format).join(',');
};

const runWorld = (run: WorldRun): string[] => {
  const engine = new SimulationEngine(1, { seed: run.seed, resourceStock: run.isStockOn });
  engine.start();
  return CHECKPOINTS.map(checkpoint => {
    const startTick = engine.getTick();
    const started = performance.now();
    while (engine.getTick() < checkpoint && engine.state === EngineState.RUNNING) engine.update();
    const ticks = engine.getTick() - startTick;
    const msPerTick = ticks > 0 ? (performance.now() - started) / ticks : 0;
    return rowOf(engine, run, msPerTick);
  });
};

describe('combined endurance report', () => {
  it.runIf(isReportEnabled)('writes the combined table for both ecologies, each seed and checkpoint', () => {
    const rows = [COLUMNS.join(',')];
    for (const seed of SEEDS) {
      for (const isStockOn of [false, true]) rows.push(...runWorld({ seed, isStockOn }));
    }
    writeFileSync(REPORT_PATH ?? 'combined-report.csv', `${rows.join('\n')}\n`);
    expect(rows.length).toBe(1 + SEEDS.length * 2 * CHECKPOINTS.length);
  }, REPORT_TIMEOUT_MS);

  it.runIf(isReportEnabled)('a save at tick 900 restores and continues like the uninterrupted run, in both ecologies', () => {
    for (const seed of CONTINUATION_SEEDS) {
      for (const isStockOn of [false, true]) {
        const label = `seed ${String(seed)}, ${isStockOn ? 'stock on' : 'default ecology'}`;
        expect(continuationDivergence(seed, isStockOn), label).toBeNull();
      }
    }
  }, REPORT_TIMEOUT_MS);
});
