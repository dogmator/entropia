/**
 * Shared entity information for UI and simulation interaction.
 */

import type { EntityId, EntityType, Vector3 } from '@shared/types';

export interface IEntityInfo {
  id: EntityId;
  type: EntityType;
  position: Vector3;
  radius: number;
}
