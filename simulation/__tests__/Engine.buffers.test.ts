/**
 * Модульні тести для валідації адаптивного управління буферами у SimulationEngine.
 *
 * Верифікація:
 * - Коректності динамічного скорочення буферів при зменшенні популяції.
 * - Запобігання частим реалокаціям через гістерезис.
 * - Забезпечення детермінованості експорту/імпорту стану.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../Engine';
import { EntityType } from '../../types';

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
      if (org) engine.organisms.set(org.id, org);
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
      if (org) engine.organisms.set(org.id, org);
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
      if (org) engine.organisms.set(org.id, org);
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
        if (org) engine.organisms.set(org.id, org);
      }
      const currentData = engine.getRenderData();

      // Ємність буфера не повинна змінюватися
      expect(currentData.predators.length).toBe(baselineCapacity);
    }
  });

  it('повинен коректно відновлювати буфери після reset()', () => {
    for (let i = 0; i < 50; i++) {
      const org = engine['spawnService'].spawnOrganism(EntityType.PREY);
      if (org) engine.organisms.set(org.id, org);
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
      if (org) engine.organisms.set(org.id, org);
    }

    const exportedState = engine.exportState();
    const newEngine = new SimulationEngine(1.0);
    newEngine.importState(exportedState);

    const originalData = engine.getRenderData();
    const restoredData = newEngine.getRenderData();

    expect(restoredData.preyCount).toBe(originalData.preyCount);
    expect(restoredData.foodCount).toBe(originalData.foodCount);
  });
});
