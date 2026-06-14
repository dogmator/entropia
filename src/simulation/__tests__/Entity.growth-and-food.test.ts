/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { createFoodId, createGenomeId, createOrganismId, EntityType, type Genome } from '@/types';

import { Food, Organism } from '../Entity';

const createGenome = (): Genome => ({
  id: createGenomeId('genome_test'),
  type: EntityType.PREY,
  subtype: 'default',
  color: 0x00ff00,
  maxSpeed: 2,
  senseRadius: 30,
  metabolism: 1,
  size: 5,
  asymmetry: 0,
  spikiness: 0,
  glowIntensity: 0.5,
  mutationRate: 0.1,
  generation: 1,
  reproductionEnergy: 100,
  parentId: null,
  flockingStrength: 0.4,
} as unknown as Genome);

describe('Entity growth and food bite model', () => {
  it('новонароджений організм стартує з ~40% adult radius', () => {
    const org = new Organism(createOrganismId('org_1'), { x: 0, y: 0, z: 0 }, createGenome(), null, 80);
    const ratio = org.radius / org.adultRadius;

    expect(ratio).toBeGreaterThanOrEqual(0.39);
    expect(ratio).toBeLessThanOrEqual(0.41);
  });

  it('організм зростає із віком та енергією', () => {
    const org = new Organism(createOrganismId('org_2'), { x: 0, y: 0, z: 0 }, createGenome(), null, 80);
    const initialRadius = org.radius;

    org.age = 400;
    org.addEnergy(220);
    org.updateGrowthFromState();

    expect(org.radius).toBeGreaterThan(initialRadius);
    expect(org.growthRatio).toBeGreaterThan(0.8);
  });

  it('їжа зменшується дискретними укусами з cooldown і пороговим видаленням', () => {
    const food = new Food(createFoodId('food_1'), { x: 0, y: 0, z: 0 }, 60);

    const firstBite = food.applyBite(15, 1);
    expect(firstBite).toBe(15);
    expect(food.currentEnergy).toBe(45);
    expect(food.radius).toBeLessThan(food.baseRadius);

    const blockedBite = food.applyBite(15, 2);
    expect(blockedBite).toBe(0);

    food.applyBite(15, 6);
    food.applyBite(15, 10);
    food.applyBite(15, 14);

    expect(food.consumed).toBe(true);
    expect(food.currentEnergy).toBe(0);
  });
});
