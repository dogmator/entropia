/**
 * Module for formatting and visual representation of organism states.
 *
 * Provides centralized logic for converting internal states into localized
 * text descriptions and color indicators.
 */

import { t } from '@/i18n';
import type { OrganismState } from '@/types';

/**
 * Immutable map of organism states to localized names.
 */
const STATE_LABELS: Readonly<Record<OrganismState, string>> = {
  IDLE: t.status.idle,
  SEEKING: t.status.seeking,
  FLEEING: t.status.fleeing,
  HUNTING: t.status.hunting,
  REPRODUCING: t.status.reproducing,
  DYING: t.status.dying,
} as const;

/**
 * Immutable map of states to Tailwind CSS styling classes.
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
 * Returns localized text description of current organism state.
 *
 * @param state - Internal state of organism activity
 * @returns Localized state name
 */
export function getStateLabel(state: OrganismState): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for possible undefined state in production
  return STATE_LABELS[state] ?? state;
}

/**
 * Determines CSS class for visual indication of organism state.
 *
 * @param state - Internal state of organism activity
 * @returns Tailwind CSS class for color indication
 */
export function getStateColor(state: OrganismState): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for possible undefined state in production
  return STATE_COLORS[state] ?? 'text-gray-400';
}

/**
 * Combined function to get full visual representation of a state.
 *
 * @param state - Internal state of organism activity
 * @returns Object with text description and styling class
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
