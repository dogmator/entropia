/**
 * Набір модульних тестів для типових предикатів сутностей.
 *
 * Верифікує коректність детермінації типів через discriminated unions
 * та гарантує відсутність false positives/negatives.
 */

import { describe, expect,it } from 'vitest';

import { EntityType } from '../../../types';
import { isFood, isObstacle, isOrganism, isValidEntity } from '../EntityTypeGuards';

describe('EntityTypeGuards', () => {
  // ========================================================================
  // ТЕСТИ ДЛЯ isOrganism()
  // ========================================================================

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

    it('має повертати false для null', () => {
      expect(isOrganism(null)).toBe(false);
    });

    it('має повертати false для undefined', () => {
      expect(isOrganism(undefined)).toBe(false);
    });

    it('має повертати false для примітивних типів', () => {
      expect(isOrganism('string')).toBe(false);
      expect(isOrganism(123)).toBe(false);
      expect(isOrganism(true)).toBe(false);
    });

    it('має повертати false для об\'єкта без поля type', () => {
      const entity = { id: 'test-4' };
      expect(isOrganism(entity)).toBe(false);
    });
  });

  // ========================================================================
  // ТЕСТИ ДЛЯ isFood()
  // ========================================================================

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
      expect(isFood(42)).toBe(false);
    });
  });

  // ========================================================================
  // ТЕСТИ ДЛЯ isObstacle()
  // ========================================================================

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

  // ========================================================================
  // ТЕСТИ ДЛЯ isValidEntity()
  // ========================================================================

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
});
