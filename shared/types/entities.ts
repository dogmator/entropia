/**
 * Entropia 3D — Типи сутностей для просторової сітки та колізій.
 *
 * @module shared/types/entities
 */

import type { EntityId } from './brands';
import type { Vector3 } from './vectors';
import type { EntityType, ZoneType } from './enums';

// ============================================================================
// ПРОСТОРОВА СІТКА
// ============================================================================

/**
 * Сутність для використання в просторовій сітці.
 */
export interface GridEntity {
  readonly id: EntityId;
  readonly position: Vector3;
  readonly type: EntityType;
  readonly radius: number;
}

// ============================================================================
// ЕКОЛОГІЧНІ ЗОНИ
// ============================================================================

/**
 * Екологічна зона з модифікаторами середовища.
 */
export interface EcologicalZone {
  readonly id: string;
  readonly type: ZoneType;
  readonly center: Vector3;
  readonly radius: number;
  /** Множник швидкості появи їжі. */
  readonly foodMultiplier: number;
  /** Множник небезпеки для травоїдних. */
  readonly dangerMultiplier: number;
}

// ============================================================================
// ГЕНЕТИЧНЕ ДЕРЕВО
// ============================================================================

import type { GenomeId } from './brands';

/**
 * Вузол генетичного дерева для філогенетичного аналізу.
 */
export interface GeneticTreeNode {
  readonly id: GenomeId;
  readonly parentId: GenomeId | null;
  readonly children: readonly GenomeId[];
  readonly generation: number;
  /** Такт народження. */
  readonly born: number;
  /** Такт смерті (null якщо живий). */
  readonly died: number | null;
  readonly type: EntityType;
  readonly traits: {
    readonly speed: number;
    readonly sense: number;
    readonly size: number;
  };
}

/**
 * Повне генетичне дерево популяції.
 */
export interface GeneticTree {
  readonly nodes: ReadonlyMap<GenomeId, GeneticTreeNode>;
  readonly roots: readonly GenomeId[];
  readonly maxGeneration: number;
}
