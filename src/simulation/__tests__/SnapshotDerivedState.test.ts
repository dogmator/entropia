import { describe, expect, it, vi } from 'vitest';

import { WORLD_SIZE } from '@/config';
import { logger } from '@/core';
import type { GridEntity } from '@/types';
import { EntityType } from '@/types';

import { SimulationEngine } from '../engine/Engine';

const CHECK = 50;
const SEED_A = 4242;
const SEED_B = 99;
const WORLD_SPAN = 2;
const WHOLE_WORLD_RADIUS = WORLD_SIZE * WORLD_SPAN;
const ORIGIN = { x: 0, y: 0, z: 0 };

const createStarted = (seed: number): SimulationEngine => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  return engine;
};

const advance = (engine: SimulationEngine, ticks: number): void => {
  for (let i = 0; i < ticks; i++) engine.update();
};

// Identity includes position, because obstacle ids are counter-based and repeat across seeds.
const obstacleSignature = (engine: SimulationEngine): string[] =>
  [...engine.obstacles.values()]
    .map(o => `${o.id}:${String(o.position.x)}:${String(o.position.y)}:${String(o.position.z)}`)
    .sort((a, b) => a.localeCompare(b));

// A query returns an obstacle once per grid cell it spans, so the signatures are de-duplicated.
const staticGridSignature = (engine: SimulationEngine): string[] => {
  const buffer: GridEntity[] = [];
  engine.gridManager.getNearby(ORIGIN, WHOLE_WORLD_RADIUS, buffer);
  const signatures = buffer
    .filter(e => e.type === EntityType.OBSTACLE)
    .map(e => `${e.id}:${String(e.position.x)}:${String(e.position.y)}:${String(e.position.z)}`);
  return [...new Set(signatures)].sort((a, b) => a.localeCompare(b));
};

describe('derived spatial state after snapshot import and reset', () => {
  it('import rebuilds the static obstacle grid from the imported obstacles', () => {
    const source = createStarted(SEED_A);
    advance(source, CHECK);

    // The restored engine starts with obstacles from another seed. Its grid must follow the imported obstacles.
    const restored = new SimulationEngine(1, { seed: SEED_B });
    restored.importState(source.exportState());

    expect(staticGridSignature(restored)).toEqual(obstacleSignature(restored));
    expect(obstacleSignature(restored)).toEqual(obstacleSignature(source));
  });

  it('reset rebuilds the static obstacle grid from the regenerated obstacles', () => {
    const engine = createStarted(SEED_A);
    advance(engine, CHECK);

    engine.reset();

    expect(staticGridSignature(engine)).toEqual(obstacleSignature(engine));
  });
});

describe('food bite cooldown across snapshots', () => {
  const BITE_CHECK = 100;

  it('keeps the last bite tick of every food item, including items never bitten', () => {
    const source = createStarted(SEED_A);
    advance(source, BITE_CHECK);
    const sourceFood = [...source.food.values()];
    // Precondition: the snapshot must contain both bitten and never-bitten food to make the check meaningful.
    expect(sourceFood.some(f => Number.isFinite(f.lastBiteTick))).toBe(true);
    expect(sourceFood.some(f => f.lastBiteTick === Number.NEGATIVE_INFINITY)).toBe(true);

    const restored = new SimulationEngine(1, { seed: SEED_B });
    restored.importState(source.exportState());

    for (const f of sourceFood) {
      expect(restored.food.get(f.id)?.lastBiteTick).toBe(f.lastBiteTick);
    }
  });

  it('restores a snapshot written without the cooldown as never bitten, and warns', () => {
    const source = createStarted(SEED_A);
    advance(source, BITE_CHECK);
    const legacy = structuredClone(source.exportState());
    for (const f of legacy.food) delete f.lastBiteTick;

    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const restored = new SimulationEngine(1, { seed: SEED_B });
    restored.importState(legacy);

    expect(restored.food.size).toBeGreaterThan(0);
    expect([...restored.food.values()].every(f => f.lastBiteTick === Number.NEGATIVE_INFINITY)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no food bite cooldown'), 'Persistence', expect.anything());
    warn.mockRestore();
  });
});
