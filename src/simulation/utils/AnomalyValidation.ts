import type { EcologicalZone, Vector3 } from '@/types';
import { ZoneType } from '@/types';

import { MathUtils } from '../MathUtils.utils';

/** Safety buffer applied to food spawn/import/sanitation against obstacles and zones. */
export const FOOD_ANOMALY_PADDING = 5;

export interface SphericalObstacle {
  readonly position: Vector3;
  readonly radius: number;
}

export interface SphericalZone {
  readonly center: Vector3;
  readonly radius: number;
}

export interface PositionAnomalyValidationParams {
  readonly position: Vector3;
  readonly obstacles: Iterable<SphericalObstacle>;
  readonly zones: Iterable<SphericalZone>;
  readonly worldSize: number;
  readonly obstaclePadding: number;
  readonly zonePadding: number;
  readonly checkZones?: boolean;
}

/**
 * The zones that forbid food. An oasis is where food is meant to lie, so only the other zones forbid it.
 */
export function foodForbiddingZones(zones: Iterable<EcologicalZone>): EcologicalZone[] {
  return Array.from(zones).filter(zone => zone.type !== ZoneType.OASIS);
}

/**
 * Unified position check regarding spherical anomalies.
 * Applies toroidal metrics to align behavior across all paths
 * (spawn, import, runtime sanitation).
 */
export function isPositionBlockedByAnomalies({
  position,
  obstacles,
  zones,
  worldSize,
  obstaclePadding,
  zonePadding,
  checkZones = true,
}: PositionAnomalyValidationParams): boolean {
  for (const obstacle of obstacles) {
    if (isBlockedBySphericalAnomaly(position, obstacle.position, obstacle.radius, obstaclePadding, worldSize)) {
      return true;
    }
  }

  if (!checkZones) {
    return false;
  }

  for (const zone of zones) {
    if (isBlockedBySphericalAnomaly(position, zone.center, zone.radius, zonePadding, worldSize)) {
      return true;
    }
  }

  return false;
}

/**
 * Base check "point in forbidden spherical region"
 * considering an additional safety buffer.
 */
// eslint-disable-next-line max-params
function isBlockedBySphericalAnomaly(
  position: Vector3,
  anomalyCenter: Vector3,
  anomalyRadius: number,
  padding: number,
  worldSize: number
): boolean {
  const distSq = MathUtils.toroidalDistanceSq(position, anomalyCenter, worldSize);
  const blockedRadius = anomalyRadius + padding;
  return distSq < blockedRadius * blockedRadius;
}
