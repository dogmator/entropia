/**
 * Модуль форматування та візуальної репрезентації станів організмів.
 *
 * Забезпечує централізовану логіку перетворення внутрішніх станів
 * на локалізовані текстові дескрипції та колірні індикатори.
 */

import type { OrganismState } from '@/types';

/**
 * Імутабельна карта відповідності станів організмів до локалізованих назв.
 */
const STATE_LABELS: Readonly<Record<OrganismState, string>> = {
  IDLE: 'Спокій',
  SEEKING: 'Пошук ресурсів',
  FLEEING: 'Ухилення',
  HUNTING: 'Полювання',
  REPRODUCING: 'Репродукція',
  DYING: 'Летальність',
} as const;

/**
 * Імутабельна карта відповідності станів до класів стилізації Tailwind CSS.
 */
const STATE_COLORS: Readonly<Record<OrganismState, string>> = {
  IDLE: 'text-gray-400',
  SEEKING: 'text-yellow-400',
  FLEEING: 'text-red-400',
  HUNTING: 'text-orange-400',
  REPRODUCING: 'text-pink-400',
  DYING: 'text-gray-600',
} as const;

/**
 * Повертає локалізовану текстову дескрипцію поточного стану організму.
 *
 * @param state - Внутрішній стан життєдіяльності організму
 * @returns Локалізована назва стану українською мовою
 */
export function getStateLabel(state: OrganismState): string {
  return STATE_LABELS[state] ?? state;
}

/**
 * Визначає клас CSS для візуальної індикації стану організму.
 *
 * @param state - Внутрішній стан життєдіяльності організму
 * @returns Клас Tailwind CSS для колірної індикації
 */
export function getStateColor(state: OrganismState): string {
  return STATE_COLORS[state] ?? 'text-gray-400';
}

/**
 * Комбінована функція для отримання повної візуальної репрезентації стану.
 *
 * @param state - Внутрішній стан життєдіяльності організму
 * @returns Об'єкт з текстовою дескрипцією та класом стилізації
 */
export function getStateRepresentation(state: OrganismState): {
  label: string;
  colorClass: string;
} {
  return {
    label: getStateLabel(state),
    colorClass: getStateColor(state),
  };
}
