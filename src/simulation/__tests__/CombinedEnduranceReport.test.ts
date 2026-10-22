/* eslint-disable @typescript-eslint/no-magic-numbers */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FOOD_ENERGY_VALUE, RESOURCE_STOCK_UNITS_PER_FOOD } from '@/config';
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
const COLUMNS = [
  'mode', 'seed', 'tick', 'extinct', 'organisms', 'food',
  'zoneStockMin', 'ledgerResidual',
  'genealogyNodes', 'genealogyBytes', 'snapshotBytes', 'storedPayloadBytes', 'msPerTick',
];

interface WorldRun {
  readonly seed: number;
  readonly isStockOn: boolean;
}

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
    run.isStockOn ? paid - accounted : Number.NaN,
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
});
