/* eslint-disable @typescript-eslint/no-magic-numbers */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FOOD_ENERGY_VALUE, RESOURCE_STOCK_UNITS_PER_FOOD } from '@/config';
import { EngineState } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Measurement harness for the stage J pilot. Seeds and checkpoints are fixed, so the counts are repeatable. Each row is
// one world at one tick, with the resource stock off or on. PILOT_REPORT=1 writes the CSV to PILOT_REPORT_PATH. The
// report is not part of the regular suite, because a full run takes minutes.
const SEEDS = [4242, 1, 3735928559, 7, 2024, 99];
const CHECKPOINTS = [100, 300, 900, 1500];
const isReportEnabled = process.env['PILOT_REPORT'] === '1';
const REPORT_PATH = process.env['PILOT_REPORT_PATH'];
const REPORT_TIMEOUT_MS = 900_000;
const COLUMNS = [
  'mode', 'seed', 'tick', 'extinct', 'organisms', 'prey', 'predators', 'food',
  'zoneStockMin', 'zoneStockMean', 'unitsRegenerated', 'unitsSpent', 'attemptsRefused',
  'energyAbsorbed', 'energyDiscarded', 'energyRemoved', 'energyRequested', 'foodEnergyRemaining', 'openingFoodEnergy',
  'ledgerResidual', 'msPerTick',
];

// Whole numbers stay whole. Other numbers keep six decimals. A missing number is an empty cell.
const format = (value: number | string): string => {
  if (typeof value === 'string') return value;
  if (Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
};

const rowOf = (engine: SimulationEngine, world: { seed: number; isStockOn: boolean }, msPerTick: number): string => {
  const stats = engine.getStats();
  const ledger = engine.getResourceLedger();
  const stocks = Array.from(engine.zones.keys(), id => engine.resourceStock.stockOf(id));
  const zoneStockMin = Math.min(...stocks);
  const zoneStockMean = stocks.reduce((sum, level) => sum + level, 0) / stocks.length;
  const accounted = ledger.energyAbsorbed + ledger.energyDiscarded + ledger.energyRemoved + ledger.foodEnergyRemaining;
  const paid = (ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD) * FOOD_ENERGY_VALUE;
  // The ledger balances only when food is paid from the stock. With the stock off the column is left empty.
  const ledgerResidual = world.isStockOn ? paid + ledger.openingFoodEnergy - accounted : Number.NaN;
  const values: (number | string)[] = [
    world.isStockOn ? 'on' : 'off', world.seed, engine.getTick(), engine.state === EngineState.RUNNING ? 0 : 1,
    engine.organisms.size, stats.preyCount, stats.predatorCount, stats.foodCount,
    zoneStockMin, zoneStockMean, ledger.unitsRegenerated, ledger.unitsSpent, ledger.attemptsRefused,
    ledger.energyAbsorbed, ledger.energyDiscarded, ledger.energyRemoved, ledger.energyRequested, ledger.foodEnergyRemaining, ledger.openingFoodEnergy,
    ledgerResidual, msPerTick,
  ];
  return values.map(format).join(',');
};

const runWorld = (seed: number, isStockOn: boolean): string[] => {
  const engine = new SimulationEngine(1, { seed, resourceStock: isStockOn });
  engine.start();
  return CHECKPOINTS.map(checkpoint => {
    const startTick = engine.getTick();
    const started = performance.now();
    while (engine.getTick() < checkpoint && engine.state === EngineState.RUNNING) engine.update();
    const ticks = engine.getTick() - startTick;
    const msPerTick = ticks > 0 ? (performance.now() - started) / ticks : 0;
    return rowOf(engine, { seed, isStockOn }, msPerTick);
  });
};

describe('resource stock pilot report', () => {
  it.runIf(isReportEnabled)('writes the pilot table for the stock off and on, for each seed and checkpoint', () => {
    const rows = [COLUMNS.join(',')];
    for (const seed of SEEDS) {
      for (const isStockOn of [false, true]) rows.push(...runWorld(seed, isStockOn));
    }
    writeFileSync(REPORT_PATH ?? 'pilot-report.csv', `${rows.join('\n')}\n`);
    expect(rows.length).toBe(1 + SEEDS.length * 2 * CHECKPOINTS.length);
  }, REPORT_TIMEOUT_MS);
});
