/**
 * Shared entity information for UI and simulation interaction.
 */

import type { EntityId, EntityType, Vector3 } from '@shared/types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IEntityInfo {
  id: EntityId;
  type: EntityType;
  position: Vector3;
  radius: number;
}
