/**
 * Набір модульних тестів для типових предикатів сутностей.
 *
 * Верифікує коректність детермінації типів через discriminated unions
 * та гарантує відсутність false positives/negatives.
 */

import { describe, expect, it } from 'vitest';

import { EntityType } from '../../../types';
import { isFood, isObstacle, isOrganism, isValidEntity } from '../EntityTypeGuards';

describe('isOrganism()', () => {
  it('має повертати true для об\'єкта з типом PREY', () => {
    const entity = { type: EntityType.PREY, id: 'test-1' };
    expect(isOrganism(entity)).toBe(true);
  });

  it('має повертати true для об\'єкта з типом PREDATOR', () => {
    const entity = { type: EntityType.PREDATOR, id: 'test-2' };
    expect(isOrganism(entity)).toBe(true);
  });

  it('має повертати false для об\'єкта з типом FOOD', () => {
    const entity = { type: EntityType.FOOD, id: 'test-3' };
    expect(isOrganism(entity)).toBe(false);
  });
});

describe('isOrganism edge cases', () => {
  it('має повертати false для null/undefined', () => {
    expect(isOrganism(null)).toBe(false);
    expect(isOrganism(undefined)).toBe(false);
  });

  it('має повертати false для примітивних типів', () => {
    const TEST_NUMBER = 123;
    expect(isOrganism('string')).toBe(false);
    expect(isOrganism(TEST_NUMBER)).toBe(false);
    expect(isOrganism(true)).toBe(false);
  });

  it('має повертати false для об\'єкта без поля type', () => {
    const entity = { id: 'test-4' };
    expect(isOrganism(entity)).toBe(false);
  });
});

describe('isFood()', () => {
  it('має повертати true для об\'єкта з типом FOOD', () => {
    const entity = { type: EntityType.FOOD, id: 'food-1' };
    expect(isFood(entity)).toBe(true);
  });

  it('має повертати false для об\'єкта з типом PREY', () => {
    const entity = { type: EntityType.PREY, id: 'org-1' };
    expect(isFood(entity)).toBe(false);
  });

  it('має повертати false для null', () => {
    expect(isFood(null)).toBe(false);
  });

  it('має повертати false для примітивних типів', () => {
    const TEST_NUMBER = 42;
    expect(isFood(TEST_NUMBER)).toBe(false);
  });
});

describe('isObstacle()', () => {
  it('має повертати true для об\'єкта з типом OBSTACLE', () => {
    const entity = { type: EntityType.OBSTACLE, id: 'obs-1' };
    expect(isObstacle(entity)).toBe(true);
  });

  it('має повертати false для об\'єкта з типом FOOD', () => {
    const entity = { type: EntityType.FOOD, id: 'food-1' };
    expect(isObstacle(entity)).toBe(false);
  });

  it('має повертати false для null', () => {
    expect(isObstacle(null)).toBe(false);
  });
});

describe('isValidEntity()', () => {
  it('має повертати true для всіх валідних типів сутностей', () => {
    expect(isValidEntity({ type: EntityType.PREY })).toBe(true);
    expect(isValidEntity({ type: EntityType.PREDATOR })).toBe(true);
    expect(isValidEntity({ type: EntityType.FOOD })).toBe(true);
    expect(isValidEntity({ type: EntityType.OBSTACLE })).toBe(true);
  });

  it('має повертати false для невалідних об\'єктів', () => {
    expect(isValidEntity(null)).toBe(false);
    expect(isValidEntity({ id: 'test' })).toBe(false);
    expect(isValidEntity('invalid')).toBe(false);
  });
});
