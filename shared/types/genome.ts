/**
 * Entropia 3D — Типи генетичної системи.
 *
 * Визначає структуру геному організмів та механізми
 * спадкування генетичних ознак.
 *
 * @module shared/types/genome
 */

import type { GenomeId } from './brands';
import { EntityType, PredatorSubtype } from './enums';

// ============================================================================
// БАЗОВИЙ ГЕНОМ
// ============================================================================

/**
 * Базовий дескриптор геному з інваріантними характеристиками.
 */
interface BaseGenome {
  /** Унікальний ідентифікатор генетичного коду. */
  readonly id: GenomeId;
  /** Посилання на батьківський геном (для філогенетичного аналізу). */
  readonly parentId: GenomeId | null;
  /** Порядковий номер покоління. */
  readonly generation: number;
  /** Колір організму (hex). */
  readonly color: number;
  /** Максимальна швидкість руху. */
  readonly maxSpeed: number;
  /** Радіус сприйняття оточення. */
  readonly senseRadius: number;
  /** Інтенсивність метаболізму. */
  readonly metabolism: number;
  /** Фізичний розмір організму. */
  readonly size: number;

  // Морфологічні ознаки
  /** Коефіцієнт деформації форми (0-1). */
  readonly asymmetry: number;
  /** Ступінь вираженості виступів (0-1). */
  readonly spikiness: number;
  /** Амплітуда візуального світіння (0-1). */
  readonly glowIntensity: number;
}

// ============================================================================
// СПЕЦІАЛІЗОВАНІ ГЕНОМИ
// ============================================================================

/**
 * Геном травоїдного організму.
 */
export interface PreyGenome extends BaseGenome {
  readonly type: typeof EntityType.PREY;
  /** Схильність до групової поведінки (флокінг). */
  readonly flockingStrength: number;
}

/**
 * Геном хижого організму.
 */
export interface PredatorGenome extends BaseGenome {
  readonly type: typeof EntityType.PREDATOR;
  /** Еволюційний підтип хижака. */
  readonly subtype: PredatorSubtype;
  /** Сила атаки. */
  readonly attackPower: number;
  /** Схильність до формування зграй. */
  readonly packAffinity: number;
}

/**
 * Об'єднаний тип геному.
 */
export type Genome = PreyGenome | PredatorGenome;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Перевіряє чи геном належить травоїдному.
 */
export const isPreyGenome = (g: Genome): g is PreyGenome =>
  g.type === EntityType.PREY;

/**
 * Перевіряє чи геном належить хижаку.
 */
export const isPredatorGenome = (g: Genome): g is PredatorGenome =>
  g.type === EntityType.PREDATOR;
