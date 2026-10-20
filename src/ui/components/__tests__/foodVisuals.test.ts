/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { FOOD_GEOMETRY_RADIUS, foodBoundingRadius, foodInstanceScale } from '../foodVisuals';

describe('food visuals — size consistency', () => {
  it('scales the instance with the model radius and the resource scale', () => {
    expect(foodInstanceScale(2, 1)).toBe(2);
    expect(foodInstanceScale(2, 1.5)).toBe(3);
    expect(foodInstanceScale(0.5, 2)).toBe(1);
  });

  it('bounds the rendered icosahedron, so frustum culling never drops visible food', () => {
    for (const instanceScale of [0.5, 1, 2, 4]) {
      // The rendered sphere has radius FOOD_GEOMETRY_RADIUS * instanceScale. Culling must use at least that.
      expect(foodBoundingRadius(instanceScale)).toBe(FOOD_GEOMETRY_RADIUS * instanceScale);
    }
  });

  it('keeps the bounding sphere larger than the instance scale whenever the geometry is larger than one unit', () => {
    expect(FOOD_GEOMETRY_RADIUS).toBeGreaterThan(1);
    expect(foodBoundingRadius(1)).toBeGreaterThan(1);
  });
});
