/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { ENTITY_CONSTANTS } from '@/config';
import type { FoodId } from '@/types';

import { Food } from '../Entity';
import { BufferManager } from '../services/BufferManager.manager';

const FOOD_STRIDE = 5;
const RADIUS_OFFSET = 3;
const BITE_SPACING_TICKS = ENTITY_CONSTANTS.FOOD_BITE_COOLDOWN_TICKS;

const createFood = (index: number): Food => new Food(`food_${String(index)}` as FoodId, { x: index, y: 0, z: 0 });

describe('food size — model, buffer and render agree', () => {
  it('starts at the base radius and shrinks with energy down to the minimum factor', () => {
    const food = createFood(1);
    expect(food.radius).toBe(ENTITY_CONSTANTS.FOOD_RADIUS);

    let tick = 0;
    let previous = food.radius;
    while (food.currentEnergy > 0 && !food.consumed) {
      food.applyBite(ENTITY_CONSTANTS.FOOD_BITE_ENERGY, tick);
      tick += BITE_SPACING_TICKS;
      expect(food.radius).toBeLessThanOrEqual(previous);
      previous = food.radius;
    }

    expect(food.radius).toBeGreaterThanOrEqual(ENTITY_CONSTANTS.FOOD_RADIUS * ENTITY_CONSTANTS.FOOD_MIN_RADIUS_FACTOR);
  });

  it('writes exactly the model radius into the render buffer after a bite', () => {
    const food = createFood(7);
    food.applyBite(ENTITY_CONSTANTS.FOOD_BITE_ENERGY, 0);
    const manager = new BufferManager();

    const buffers = manager.getRenderData(new Map(), new Map(), new Map([[food.id, food]]));

    expect(buffers.foodCount).toBe(1);
    expect(buffers.food[RADIUS_OFFSET]).toBeCloseTo(food.radius, 6);
    expect(buffers.food.length).toBeGreaterThanOrEqual(FOOD_STRIDE);
  });

  it('keeps one buffer record per food item, in the order the items are supplied', () => {
    const items = [createFood(1), createFood(2), createFood(3)];
    items[1]?.applyBite(ENTITY_CONSTANTS.FOOD_BITE_ENERGY, 0);
    const manager = new BufferManager();

    const buffers = manager.getRenderData(new Map(), new Map(), new Map(items.map(f => [f.id, f])));

    expect(buffers.foodCount).toBe(items.length);
    items.forEach((food, i) => {
      expect(buffers.food[i * FOOD_STRIDE + RADIUS_OFFSET]).toBeCloseTo(food.radius, 6);
    });
  });
});
