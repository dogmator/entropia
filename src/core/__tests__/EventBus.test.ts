import { describe, expect, it, vi } from 'vitest';

import { createFoodId, EntityType, vec3 } from '@/types';

import { EventBus } from '../EventBus';

const TEST_POSITION = vec3(1, 1, 1);

describe('EventBus', () => {
  it('onAll викликає callback рівно один раз на подію', () => {
    const eventBus = new EventBus();
    const callback = vi.fn();

    eventBus.onAll(callback);

    eventBus.emit({
      type: 'EntitySpawned',
      entityType: EntityType.FOOD,
      id: createFoodId('food-1'),
      position: TEST_POSITION,
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
