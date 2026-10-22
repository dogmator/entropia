/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { describe, expect, it, vi } from 'vitest';

import {
  FOOD_ENERGY_VALUE,
  RESOURCE_STOCK_CAPACITY_PER_ZONE,
  RESOURCE_STOCK_REGEN_PER_TICK,
  RESOURCE_STOCK_UNITS_PER_FOOD,
} from '@/config';
import { logger } from '@/core';
import type { EcologicalZone, EntitySpawnedEvent, SerializedSimulationStateV1 } from '@/types';
import { EngineState, EntityType, ZoneType } from '@/types';

import { SimulationEngine } from '../engine/Engine';
import { ResourceStock } from '../services/ResourceStock.service';

// Stage J pilot: a finite food stock per zone, opt-in. The checks below are the acceptance criteria of the pilot: bounded
// stock, a balanced energy ledger, deterministic continuation after a save, no hidden food rescue, and real extinction.
const SEED = 4242;
const OTHER_SEED = 1;
const RESTORE_SEED = 99;
const HORIZON_TICKS = 300;
const CHECKPOINT_TICK = 60;
const CONTINUATION_TICKS = 40;
const DEPLETION_TICKS = 620;
const EXTINCTION_TICKS = 300;
const KEEP_ALIVE_ENERGY = 1000;
const LEDGER_TOLERANCE = 1e-9;
const DEPLETION_WARNING = 'Fail-safe: resource depletion detected';
// Runs of hundreds of ticks with a few hundred organisms take seconds alone, and more under the concurrent gate.
const LONG_RUN_TIMEOUT_MS = 180_000;

const zoneAt = (id: string, x: number): EcologicalZone => ({
  id,
  type: ZoneType.DESERT,
  center: { x, y: 0, z: 0 },
  radius: 1,
  foodMultiplier: 1,
  dangerMultiplier: 1,
});

const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const roundTrip = (state: SerializedSimulationStateV1): SerializedSimulationStateV1 =>
  JSON.parse(JSON.stringify(state)) as SerializedSimulationStateV1;

const firstDivergentTick = (uninterrupted: SimulationEngine, restored: SimulationEngine, ticks: number): number | null => {
  for (let i = 0; i < ticks; i++) {
    uninterrupted.update();
    restored.update();
    if (comparable(restored) !== comparable(uninterrupted)) return uninterrupted.getTick();
  }
  return null;
};

const stockWorld = (seed: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed, resourceStock: true });
  engine.start();
  return engine;
};

describe('resource stock: zones and regeneration', () => {
  it('assigns a position to the zone whose centre is nearest, and a tie to the zone listed first', () => {
    const stock = new ResourceStock();
    stock.reset([zoneAt('west', 0), zoneAt('east', 100)], { enabled: true, stocks: undefined });

    expect(stock.zoneAt({ x: 10, y: 0, z: 0 })).toBe('west');
    expect(stock.zoneAt({ x: 90, y: 0, z: 0 })).toBe('east');
    expect(stock.zoneAt({ x: 50, y: 0, z: 0 })).toBe('west');
  });

  it('regenerates a fixed amount per tick, and never above the capacity', () => {
    const stock = new ResourceStock();
    stock.reset([zoneAt('only', 0)], { enabled: true, stocks: { only: 0 } });

    stock.regenerate();
    expect(stock.stockOf('only')).toBeCloseTo(RESOURCE_STOCK_REGEN_PER_TICK, 12);

    for (let tick = 0; tick < 1000; tick++) stock.regenerate();
    expect(stock.stockOf('only')).toBe(RESOURCE_STOCK_CAPACITY_PER_ZONE);
  });

  it('pays one unit per food item, and refuses food from an empty zone without paying', () => {
    const stock = new ResourceStock();
    stock.reset([zoneAt('only', 0)], { enabled: true, stocks: { only: RESOURCE_STOCK_UNITS_PER_FOOD } });

    expect(stock.admitFoodAt({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(stock.stockOf('only')).toBe(0);
    expect(stock.admitFoodAt({ x: 1, y: 0, z: 0 })).toBe(false);
    expect(stock.stockOf('only')).toBe(0);
    expect(stock.unitsSpent).toBe(RESOURCE_STOCK_UNITS_PER_FOOD);
    expect(stock.attemptsRefused).toBe(1);
  });

  it('with the stock off, admits every item and changes nothing', () => {
    const stock = new ResourceStock();
    stock.reset([zoneAt('only', 0)], { enabled: false, stocks: { only: 0 } });

    stock.regenerate();
    expect(stock.admitFoodAt({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(stock.stockOf('only')).toBe(0);
    expect(stock.unitsRegenerated).toBe(0);
    expect(stock.unitsSpent).toBe(0);
  });
});

describe('resource stock: engine behaviour', () => {
  it('keeps every zone between zero and its capacity at every tick', () => {
    const engine = stockWorld(SEED);
    const zoneIds = Array.from(engine.zones.keys());

    for (let tick = 0; tick < HORIZON_TICKS; tick++) {
      engine.update();
      for (const id of zoneIds) {
        const level = engine.resourceStock.stockOf(id);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(RESOURCE_STOCK_CAPACITY_PER_ZONE);
      }
    }
  }, LONG_RUN_TIMEOUT_MS);

  it('balances the energy ledger: the energy paid into food equals what was eaten, discarded, removed and still held', () => {
    for (const seed of [SEED, OTHER_SEED]) {
      const engine = stockWorld(seed);
      for (let tick = 0; tick < HORIZON_TICKS; tick++) engine.update();

      const ledger = engine.getResourceLedger();
      const paid = (ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD) * FOOD_ENERGY_VALUE;
      const supplied = paid + ledger.openingFoodEnergy;
      const accounted = ledger.energyAbsorbed + ledger.energyDiscarded + ledger.energyRemoved + ledger.foodEnergyRemaining;

      expect(ledger.enabled).toBe(true);
      expect(ledger.unitsSpent).toBeGreaterThan(0);
      expect(ledger.openingFoodEnergy).toBe(0);
      expect(Math.abs(supplied - accounted)).toBeLessThanOrEqual(LEDGER_TOLERANCE * Math.max(1, supplied));
    }
  }, LONG_RUN_TIMEOUT_MS);

  it('balances the energy ledger after a restore: food the snapshot brings in is opening energy, not paid energy', () => {
    const source = stockWorld(SEED);
    for (let tick = 0; tick < CHECKPOINT_TICK; tick++) source.update();

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(roundTrip(source.exportState()));
    restored.start();
    for (let tick = 0; tick < CONTINUATION_TICKS; tick++) restored.update();

    const ledger = restored.getResourceLedger();
    const paid = (ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD) * FOOD_ENERGY_VALUE;
    const supplied = paid + ledger.openingFoodEnergy;
    const accounted = ledger.energyAbsorbed + ledger.energyDiscarded + ledger.energyRemoved + ledger.foodEnergyRemaining;

    // Without the opening term the residual would equal the food energy the snapshot held, so this check has teeth.
    expect(ledger.openingFoodEnergy).toBeGreaterThan(0);
    expect(Math.abs(supplied - accounted)).toBeLessThanOrEqual(LEDGER_TOLERANCE * Math.max(1, supplied));
  }, LONG_RUN_TIMEOUT_MS);

  it('announces food only when the stock admits it, so every food spawn event stands for one paid item', () => {
    const engine = stockWorld(SEED);
    // Every zone starts empty, so most attempts are refused. A refused attempt must leave no spawn event behind.
    const empty: Record<string, number> = {};
    for (const id of engine.zones.keys()) empty[id] = 0;
    engine.resourceStock.reset(engine.zones.values(), { enabled: true, stocks: empty });

    let foodAnnounced = 0;
    engine.eventBus.on<EntitySpawnedEvent>('EntitySpawned', event => {
      if (event.entityType === EntityType.FOOD) foodAnnounced++;
    });
    for (let tick = 0; tick < HORIZON_TICKS; tick++) engine.update();

    const ledger = engine.getResourceLedger();
    expect(ledger.attemptsRefused).toBeGreaterThan(0);
    expect(foodAnnounced).toBe(ledger.unitsSpent / RESOURCE_STOCK_UNITS_PER_FOOD);
  }, LONG_RUN_TIMEOUT_MS);

  it('restores a saved stock world and continues exactly like the uninterrupted run', () => {
    const source = stockWorld(SEED);
    for (let tick = 0; tick < CHECKPOINT_TICK; tick++) source.update();

    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(roundTrip(source.exportState()));
    restored.start();

    expect(restored.resourceStock.isEnabled).toBe(true);
    expect(firstDivergentTick(source, restored, CONTINUATION_TICKS)).toBeNull();
  });

  it('places the stock on the zone centres of the snapshot, not on those of the world it is imported into', () => {
    const source = stockWorld(SEED);
    const snapshot = roundTrip(source.exportState());
    const sanctuary = snapshot.zones.find(zone => zone.id === 'sanctuary');
    if (!sanctuary) throw new Error('the snapshot has no sanctuary zone');
    // A point next to the centre of desert_0 in the world the snapshot is imported into, moved here in the snapshot.
    sanctuary.center = { x: 1, y: 1, z: 1 };

    const target = stockWorld(RESTORE_SEED);
    target.importState(snapshot);

    expect(target.resourceStock.zoneAt({ x: 1, y: 1, z: 1 })).toBe('sanctuary');
  });

  it('imports a snapshot without a stock with the stock off, so a baseline world stays a baseline world', () => {
    const baseline = new SimulationEngine(1, { seed: SEED });
    baseline.start();
    for (let tick = 0; tick < CHECKPOINT_TICK; tick++) baseline.update();
    const snapshot = roundTrip(baseline.exportState());
    expect(snapshot.resourceStock).toBeUndefined();

    const target = stockWorld(RESTORE_SEED);
    target.importState(snapshot);

    expect(target.resourceStock.isEnabled).toBe(false);
  });

  it('rejects a stock snapshot that misses a zone, or holds a stock outside the capacity, without changing the engine', () => {
    const source = stockWorld(SEED);
    for (let tick = 0; tick < CHECKPOINT_TICK; tick++) source.update();
    const snapshot = roundTrip(source.exportState());
    const zoneIds = Object.keys(snapshot.resourceStock?.zoneStocks ?? {});
    const firstZone = zoneIds[0] ?? '';

    const target = stockWorld(RESTORE_SEED);
    const before = comparable(target);

    const missing = structuredClone(snapshot);
    delete missing.resourceStock?.zoneStocks[firstZone];
    expect(() => { target.importState(missing); }).toThrow(/one stock per zone/);

    const overfull = structuredClone(snapshot);
    if (overfull.resourceStock) overfull.resourceStock.zoneStocks[firstZone] = RESOURCE_STOCK_CAPACITY_PER_ZONE + 1;
    expect(() => { target.importState(overfull); }).toThrow(/must be between 0 and/);

    expect(comparable(target)).toBe(before);
  });

  it('does not run the depletion fail-safe with the stock on, so no food appears without stock', () => {
    const warn = vi.spyOn(logger, 'warn');
    const countDepletionWarnings = (resourceStock: boolean): number => {
      warn.mockClear();
      const engine = new SimulationEngine(1, { seed: SEED, resourceStock });
      engine.start();
      Object.assign(engine.config, { foodSpawnRate: 0 });
      for (let tick = 0; tick < DEPLETION_TICKS; tick++) {
        for (const organism of engine.organisms.values()) organism.energy = KEEP_ALIVE_ENERGY;
        engine.food.clear();
        engine.update();
      }
      expect(engine.food.size).toBe(0);
      return warn.mock.calls.filter(call => call[0] === DEPLETION_WARNING).length;
    };

    // The baseline must trigger the fail-safe in this scenario, or the check below proves nothing.
    expect(countDepletionWarnings(false)).toBeGreaterThan(0);
    expect(countDepletionWarnings(true)).toBe(0);
    warn.mockRestore();
  }, LONG_RUN_TIMEOUT_MS);

  it('still pauses an extinct stock world, and does not bring the population back', () => {
    const engine = stockWorld(SEED);
    for (let tick = 0; tick < EXTINCTION_TICKS; tick++) {
      for (const organism of engine.organisms.values()) organism.energy = 0;
      engine.update();
    }

    expect(engine.state).toBe(EngineState.PAUSED);
    expect(engine.organisms.size).toBe(0);
  }, LONG_RUN_TIMEOUT_MS);
});
