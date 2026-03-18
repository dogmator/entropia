/**
 * Модульні тести для валідації адаптивного управління буферами у SimulationEngine.
 *
 * Верифікація:
 * - Коректності динамічного скорочення буферів при зменшенні популяції.
 * - Запобігання частим реалокаціям через гістерезис.
 * - Забезпечення детермінованості експорту/імпорту стану.
 */

import { beforeEach,describe, expect, it, vi } from 'vitest';

import { EntityType } from '@/types';

import { SimulationEngine } from '../Engine';
import { Food } from '../Entity';

describe('SimulationEngine — Адаптивні буфери рендерингу', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(1.0);
  });

  it('повинен створювати буфери з запасом при зростанні популяції', () => {
    // Початковий стан
    const initialData = engine.getRenderData();
    const initialCapacity = initialData.prey.length;

    // Спавн великої кількості організмів
    for (let i = 0; i < 100; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREY);
      if (org) {engine.organisms.set(org.id, org);}
    }

    const afterSpawnData = engine.getRenderData();
    const afterCapacity = afterSpawnData.prey.length;

    // Буфер має збільшитися з коефіцієнтом ≥ 1.25 (growth factor 1.5 - overhead)
    expect(afterCapacity).toBeGreaterThan(100 * 13); // STRIDE = 13
    expect(afterCapacity / (100 * 13)).toBeGreaterThanOrEqual(1.25);
  });

  it('повинен скорочувати буфери при значному зменшенні популяції (>75%)', () => {
    // Крок 1: Створення великої популяції
    for (let i = 0; i < 200; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREY);
      if (org) {engine.organisms.set(org.id, org);}
    }
    engine.getRenderData();

    // Крок 2: Різке зменшення до 20 організмів (скорочення на 90%)
    const toKeep = Array.from(engine.organisms.values()).slice(0, 20);
    engine.organisms.clear();
    toKeep.forEach(o => engine.organisms.set(o.id, o));

    const afterShrinkData = engine.getRenderData();
    const shrunkCapacity = afterShrinkData.prey.length;

    // Очікуваний розмір: близько 20 * 13 * 1.25 ≈ 325
    expect(shrunkCapacity).toBeLessThan(500); // Суттєво менше за початкові ~3900
    expect(shrunkCapacity).toBeGreaterThanOrEqual(20 * 13); // Але достатньо для поточних
  });

  it('повинен запобігати частим реалокаціям при незначних коливаннях', () => {
    // Створення базової популяції
    for (let i = 0; i < 100; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREDATOR);
      if (org) {engine.organisms.set(org.id, org);}
    }
    const baselineData = engine.getRenderData();
    const baselineCapacity = baselineData.predators.length;

    // Симуляція коливань популяції ±10%
    for (let cycle = 0; cycle < 5; cycle++) {
      // Зменшення на 10
      const toRemove = Array.from(engine.organisms.values()).slice(0, 10);
      toRemove.forEach(o => engine.organisms.delete(o.id));
      engine.getRenderData();

      // Збільшення на 10
      for (let i = 0; i < 10; i++) {
        const org = engine['spawnService'].spawnOrganism(EntityType.PREDATOR);
        if (org) {engine.organisms.set(org.id, org);}
      }
      const currentData = engine.getRenderData();

      // Ємність буфера не повинна змінюватися
      expect(currentData.predators.length).toBe(baselineCapacity);
    }
  });

  it('повинен коректно відновлювати буфери після reset()', () => {
    for (let i = 0; i < 50; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREY);
      if (org) {engine.organisms.set(org.id, org);}
    }
    engine.getRenderData();

    engine.reset();
    const resetData = engine.getRenderData();

    // Після ресету популяція повертається до початкової
    expect(resetData.preyCount).toBe(engine.worldConfig.INITIAL_PREY);
    expect(resetData.predatorCount).toBe(engine.worldConfig.INITIAL_PREDATOR);
  });

  it('повинен підтримувати детермінованість експорту/імпорту стану', () => {
    for (let i = 0; i < 75; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREY);
      if (org) {engine.organisms.set(org.id, org);}
    }

    const exportedState = engine.exportState();
    const newEngine = new SimulationEngine(1.0);
    newEngine.importState(exportedState);

    const originalData = engine.getRenderData();
    const restoredData = newEngine.getRenderData();

    expect(restoredData.preyCount).toBe(originalData.preyCount);
    expect(restoredData.foodCount).toBe(originalData.foodCount);
  });

  it('повинен відкидати їжу в аномаліях під час importState', () => {
    const state = engine.exportState();
    const zone = state.zones[0];
    const obstacle = state.obstacles[0];

    expect(zone).toBeDefined();
    expect(obstacle).toBeDefined();
    if (!zone || !obstacle) {
      return;
    }

    let validFood = state.food[0];

    if (!validFood) {
      let spawned = null;
      for (let i = 0; i < 200 && !spawned; i++) {
        spawned = engine['spawnService'].spawnFood(50_000 + i);
      }

      expect(spawned).not.toBeNull();
      if (!spawned) {
        return;
      }

      validFood = {
        id: spawned.id,
        position: { ...spawned.position },
        radius: spawned.radius,
        baseRadius: spawned.baseRadius,
        energyValue: spawned.energyValue,
        maxEnergy: spawned.maxEnergy,
        currentEnergy: spawned.currentEnergy,
        spawnTime: spawned.spawnTime,
        consumed: spawned.consumed,
      };
    }

    state.food = [
      {
        ...validFood,
        id: 'food-inside-zone',
        position: { ...zone.center },
      },
      {
        ...validFood,
        id: 'food-inside-obstacle',
        position: { ...obstacle.position },
      },
      {
        ...validFood,
        id: 'food-valid',
      },
    ];

    const restoredEngine = new SimulationEngine(1.0);
    restoredEngine.importState(state);

    expect(restoredEngine.food.has('food-inside-zone')).toBe(false);
    expect(restoredEngine.food.has('food-inside-obstacle')).toBe(false);
    expect(restoredEngine.food.has('food-valid')).toBe(true);
  });

  it('повинен виконувати one-shot runtime-санітизацію їжі в аномаліях', () => {
    engine.food.clear();

    const zone = Array.from(engine.zones.values())[0];
    expect(zone).toBeDefined();
    if (!zone) {
      return;
    }

    const invalidFood = Food.create(70_001, zone.center.x, zone.center.y, zone.center.z);
    engine.food.set(invalidFood.id, invalidFood);

    let validFood: Food | null = null;
    for (let i = 0; i < 200 && !validFood; i++) {
      validFood = engine['spawnService'].spawnFood(80_000 + i);
    }

    expect(validFood).not.toBeNull();
    if (!validFood) {
      return;
    }
    engine.food.set(validFood.id, validFood);

    engine.start();
    engine.update();

    expect(engine.food.has(invalidFood.id)).toBe(false);
    expect(engine.food.has(validFood.id)).toBe(true);
  });

  it('повинен зберігати інваріант state === import(export(state))', () => {
    engine.start();
    for (let i = 0; i < 4; i++) {
      engine.update();
    }

    const exportedState = engine.exportState();
    const rehydratedEngine = new SimulationEngine(1.0);
    rehydratedEngine.importState(exportedState);
    const reExportedState = rehydratedEngine.exportState();

    expect(reExportedState).toEqual(exportedState);
  });

  it('повинен залишатися стабільним на повторному persistence cycle', () => {
    engine.start();
    for (let i = 0; i < 4; i++) {
      engine.update();
    }

    const state1 = engine.exportState();

    const engine2 = new SimulationEngine(1.0);
    engine2.importState(state1);
    const exportedFromEngine2 = engine2.exportState();

    const engine3 = new SimulationEngine(1.0);
    engine3.importState(exportedFromEngine2);
    const state2 = engine3.exportState();

    expect(state2).toEqual(state1);
  });

  it('повинен зберігати порядок виконання simulation systems у pipeline', () => {
    const order: string[] = [];
    const originalStartSubsystemTimer = engine.performanceMonitor.startSubsystemTimer.bind(engine.performanceMonitor);

    vi.spyOn(engine.performanceMonitor, 'startSubsystemTimer').mockImplementation((name) => {
      order.push(name);
      return originalStartSubsystemTimer(name);
    });

    engine.start();
    engine.update();

    expect(order).toEqual([
      'BehaviorSystem',
      'PhysicsSystem',
      'MetabolismSystem',
      'CollisionSystem',
      'ReproductionSystem',
    ]);
  });
});
