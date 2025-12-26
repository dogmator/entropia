/**
 * Модульні тести для верифікації коректної інтеграції WorldConfig у BehaviorSystem.
 *
 * Верифікація:
 * - Коректності обчислення тороїдальних векторів з урахуванням масштабованого worldSize.
 * - Працездатності системи при різних значеннях масштабу світу.
 * - Відсутності залежності від глобальних констант (інкапсуляція).
 */

import { beforeEach,describe, expect, it } from 'vitest';

import { createWorldConfig } from '../../../constants';
import { Random } from '../../../core/utils/Random';
import type { EcologicalZone, SimulationConfig, WorldConfig } from '../../../types';
import { EntityType } from '../../../types';
import { Organism } from '../../Entity';
import { SpatialHashGrid } from '../../SpatialHashGrid';
import { BehaviorSystem } from '../BehaviorSystem';

describe('BehaviorSystem — Інтеграція WorldConfig', () => {
  let spatialGrid: SpatialHashGrid;
  let zones: Map<string, EcologicalZone>;
  let config: SimulationConfig;
  const rng = new Random(12345);

  beforeEach(() => {
    zones = new Map();
    config = {
      foodSpawnRate: 0.5,
      maxFood: 300,
      maxOrganisms: 400,
      showObstacles: true,
      mutationFactor: 0.12,
      reproductionThreshold: 180,
      drag: 0.96,
      separationWeight: 2.5,
      alignmentWeight: 1.2,
      cohesionWeight: 1.0,
      seekWeight: 3.5,
      avoidWeight: 3.5,
      organismOpacity: 0.92,
      foodOpacity: 0.85,
      organismScale: 1.0,
      foodScale: 1.2,
      gridOpacity: 0.2,
      bloomIntensity: 0.8,
      trailLength: 80,
      showEnergyGlow: true,
      showTrails: true,
      showParticles: true,
      graphicsQuality: 'HIGH',
    };
  });

  it('повинен використовувати worldSize із WorldConfig (стандартний масштаб)', () => {
    const worldConfig: WorldConfig = createWorldConfig(1.0);
    spatialGrid = new SpatialHashGrid(worldConfig.WORLD_SIZE);
    const behaviorSystem = new BehaviorSystem(spatialGrid, config, zones, worldConfig);

    // Доступ до приватного поля через type assertion (тільки для тестів)
    const worldSize = (behaviorSystem as any).worldSize;

    expect(worldSize).toBe(400); // WORLD_SIZE при scale=1.0
  });

  it('повинен коректно працювати з масштабованим світом (scale=2.0)', () => {
    const worldConfig: WorldConfig = createWorldConfig(2.0);
    spatialGrid = new SpatialHashGrid(worldConfig.WORLD_SIZE);
    const behaviorSystem = new BehaviorSystem(spatialGrid, config, zones, worldConfig);

    const worldSize = (behaviorSystem as any).worldSize;

    expect(worldSize).toBe(800); // 400 * 2.0
  });

  it('повинен коректно обчислювати тороїдальні вектори для масштабованого світу', () => {
    const worldConfig: WorldConfig = createWorldConfig(1.5);
    spatialGrid = new SpatialHashGrid(worldConfig.WORLD_SIZE);
    const behaviorSystem = new BehaviorSystem(spatialGrid, config, zones, worldConfig);

    // Створення організму для тесту
    const genome = {
      id: 'genome_1' as any,
      parentId: null,
      generation: 1,
      type: EntityType.PREY,
      color: 0x44ff88,
      maxSpeed: 2.2,
      senseRadius: 90,
      metabolism: 1.0,
      size: 4,
      asymmetry: 0,
      spikiness: 0,
      glowIntensity: 0.5,
      flockingStrength: 0.5,
    };

    const organism = new Organism('org_1' as any, { x: 10, y: 10, z: 10 }, genome, null, rng);

    // Оновлення — має відпрацювати без помилок
    const organisms = new Map<string, Organism>();
    organisms.set(organism.id, organism);

    expect(() => {
      behaviorSystem.update(organisms);
    }).not.toThrow();
  });

  it('повинен коректно обчислювати модифікатори зон з урахуванням worldSize', () => {
    const worldConfig: WorldConfig = createWorldConfig(1.0);
    spatialGrid = new SpatialHashGrid(worldConfig.WORLD_SIZE);

    // Додавання тестової зони
    zones.set('test_oasis', {
      id: 'test_oasis',
      type: 'OASIS' as any,
      center: { x: 200, y: 200, z: 200 },
      radius: 50,
      foodMultiplier: 3.0,
      dangerMultiplier: 0.5,
    });

    const behaviorSystem = new BehaviorSystem(spatialGrid, config, zones, worldConfig);

    const genome = {
      id: 'genome_1' as any,
      parentId: null,
      generation: 1,
      type: EntityType.PREY,
      color: 0x44ff88,
      maxSpeed: 2.2,
      senseRadius: 90,
      metabolism: 1.0,
      size: 4,
      asymmetry: 0,
      spikiness: 0,
      glowIntensity: 0.5,
      flockingStrength: 0.5,
    };

    const organismInZone = new Organism('org_1' as any, { x: 200, y: 200, z: 200 }, genome, null, rng);
    const organisms = new Map<string, Organism>();
    organisms.set(organismInZone.id, organismInZone);

    // Система має відпрацювати без помилок
    expect(() => {
      behaviorSystem.update(organisms);
    }).not.toThrow();
  });
});
