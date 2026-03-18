import type { Vector3 } from '@/types';

import { MathUtils } from '../MathUtils';

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
 * Уніфікована перевірка позиції щодо сферичних аномалій.
 * Застосовує тороїдальну метрику, щоб узгодити поведінку
 * у всіх шляхах (spawn, import, runtime sanitation).
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
 * Базова перевірка "точка в забороненій сферичній області"
 * з урахуванням додаткового safety-buffer.
 */
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
