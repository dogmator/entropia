import { describe, expect, it } from 'vitest';

import { isPositionBlockedByAnomalies } from '../AnomalyValidation';

const WORLD_SIZE = 100;

describe('AnomalyValidation', () => {
  it('блокує позицію, якщо вона в межах перешкоди', () => {
    const isBlocked = isPositionBlockedByAnomalies({
      position: { x: 10, y: 10, z: 10 },
      obstacles: [{ position: { x: 12, y: 10, z: 10 }, radius: 3 }],
      zones: [],
      worldSize: WORLD_SIZE,
      obstaclePadding: 1,
      zonePadding: 1,
    });

    expect(isBlocked).toBe(true);
  });

  it('блокує позицію, якщо вона в межах зони при увімкненому zone-check', () => {
    const isBlocked = isPositionBlockedByAnomalies({
      position: { x: 50, y: 50, z: 50 },
      obstacles: [],
      zones: [{ center: { x: 52, y: 50, z: 50 }, radius: 3 }],
      worldSize: WORLD_SIZE,
      obstaclePadding: 0,
      zonePadding: 1,
      checkZones: true,
    });

    expect(isBlocked).toBe(true);
  });

  it('не блокує позицію в зоні, якщо zone-check вимкнено', () => {
    const isBlocked = isPositionBlockedByAnomalies({
      position: { x: 50, y: 50, z: 50 },
      obstacles: [],
      zones: [{ center: { x: 50, y: 50, z: 50 }, radius: 10 }],
      worldSize: WORLD_SIZE,
      obstaclePadding: 0,
      zonePadding: 0,
      checkZones: false,
    });

    expect(isBlocked).toBe(false);
  });

  it('враховує тороїдальну топологію при перевірці', () => {
    const isBlocked = isPositionBlockedByAnomalies({
      position: { x: 99, y: 50, z: 50 },
      obstacles: [],
      zones: [{ center: { x: 1, y: 50, z: 50 }, radius: 2.2 }],
      worldSize: WORLD_SIZE,
      obstaclePadding: 0,
      zonePadding: 0,
    });

    expect(isBlocked).toBe(true);
  });
});
