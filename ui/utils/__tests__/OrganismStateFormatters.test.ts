/**
 * Набір модульних тестів для форматерів станів організмів.
 *
 * Верифікує коректність перетворення внутрішніх станів
 * на локалізовані текстові дескрипції та класи CSS.
 */

import { describe, it, expect } from 'vitest';
import {
  getStateLabel,
  getStateColor,
  getStateRepresentation,
} from '../OrganismStateFormatters';
import { OrganismState } from '../../../types';

describe('OrganismStateFormatters', () => {
  // ========================================================================
  // ТЕСТИ ДЛЯ getStateLabel()
  // ========================================================================

  describe('getStateLabel()', () => {
    it('має повертати "Спокій" для стану IDLE', () => {
      expect(getStateLabel(OrganismState.IDLE)).toBe('Спокій');
    });

    it('має повертати "Пошук ресурсів" для стану SEEKING', () => {
      expect(getStateLabel(OrganismState.SEEKING)).toBe('Пошук ресурсів');
    });

    it('має повертати "Ухилення" для стану FLEEING', () => {
      expect(getStateLabel(OrganismState.FLEEING)).toBe('Ухилення');
    });

    it('має повертати "Полювання" для стану HUNTING', () => {
      expect(getStateLabel(OrganismState.HUNTING)).toBe('Полювання');
    });

    it('має повертати "Репродукція" для стану REPRODUCING', () => {
      expect(getStateLabel(OrganismState.REPRODUCING)).toBe('Репродукція');
    });

    it('має повертати "Летальність" для стану DYING', () => {
      expect(getStateLabel(OrganismState.DYING)).toBe('Летальність');
    });

    it('має повертати оригінальний стан для невідомого значення', () => {
      const unknownState = 'UNKNOWN' as OrganismState;
      expect(getStateLabel(unknownState)).toBe('UNKNOWN');
    });
  });

  // ========================================================================
  // ТЕСТИ ДЛЯ getStateColor()
  // ========================================================================

  describe('getStateColor()', () => {
    it('має повертати "text-gray-400" для стану IDLE', () => {
      expect(getStateColor(OrganismState.IDLE)).toBe('text-gray-400');
    });

    it('має повертати "text-yellow-400" для стану SEEKING', () => {
      expect(getStateColor(OrganismState.SEEKING)).toBe('text-yellow-400');
    });

    it('має повертати "text-red-400" для стану FLEEING', () => {
      expect(getStateColor(OrganismState.FLEEING)).toBe('text-red-400');
    });

    it('має повертати "text-orange-400" для стану HUNTING', () => {
      expect(getStateColor(OrganismState.HUNTING)).toBe('text-orange-400');
    });

    it('має повертати "text-pink-400" для стану REPRODUCING', () => {
      expect(getStateColor(OrganismState.REPRODUCING)).toBe('text-pink-400');
    });

    it('має повертати "text-gray-600" для стану DYING', () => {
      expect(getStateColor(OrganismState.DYING)).toBe('text-gray-600');
    });

    it('має повертати fallback клас для невідомого стану', () => {
      const unknownState = 'UNKNOWN' as OrganismState;
      expect(getStateColor(unknownState)).toBe('text-gray-400');
    });
  });

  // ========================================================================
  // ТЕСТИ ДЛЯ getStateRepresentation()
  // ========================================================================

  describe('getStateRepresentation()', () => {
    it('має повертати об\'єкт з label та colorClass для IDLE', () => {
      const result = getStateRepresentation(OrganismState.IDLE);
      expect(result).toEqual({
        label: 'Спокій',
        colorClass: 'text-gray-400',
      });
    });

    it('має повертати об\'єкт з label та colorClass для HUNTING', () => {
      const result = getStateRepresentation(OrganismState.HUNTING);
      expect(result).toEqual({
        label: 'Полювання',
        colorClass: 'text-orange-400',
      });
    });

    it('має повертати коректні дані для всіх станів', () => {
      const states = [
        OrganismState.IDLE,
        OrganismState.SEEKING,
        OrganismState.FLEEING,
        OrganismState.HUNTING,
        OrganismState.REPRODUCING,
        OrganismState.DYING,
      ];

      states.forEach((state) => {
        const result = getStateRepresentation(state);
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('colorClass');
        expect(typeof result.label).toBe('string');
        expect(typeof result.colorClass).toBe('string');
        expect(result.colorClass).toMatch(/^text-/);
      });
    });
  });

  // ========================================================================
  // ТЕСТИ ІМУТАБЕЛЬНОСТІ
  // ========================================================================

  describe('Immutability', () => {
    it('getStateLabel має бути детермінованою pure функцією', () => {
      const state = OrganismState.SEEKING;
      const result1 = getStateLabel(state);
      const result2 = getStateLabel(state);
      expect(result1).toBe(result2);
      expect(result1).toBe('Пошук ресурсів');
    });

    it('getStateColor має бути детермінованою pure функцією', () => {
      const state = OrganismState.FLEEING;
      const result1 = getStateColor(state);
      const result2 = getStateColor(state);
      expect(result1).toBe(result2);
      expect(result1).toBe('text-red-400');
    });
  });
});
