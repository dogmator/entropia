import { describe, expect, it, vi } from 'vitest';

import type { EntitySpawnedEvent } from '@/types';
import { createFoodId, EntityType, vec3 } from '@/types';

import { EventBus } from '../EventBus.service';

const TEST_POSITION = vec3(1, 1, 1);
const HISTORY_CAPACITY = 100;
const EMITTED_EVENTS = 120;
const FIRST_RETAINED_EVENT = 21;

function createSpawnEvent(index: number) {
  return {
    type: 'EntitySpawned' as const,
    entityType: EntityType.FOOD,
    id: createFoodId(`food-${String(index)}`),
    position: TEST_POSITION,
  };
}

describe('EventBus', () => {
  it('onAll викликає callback рівно один раз на подію', () => {
    const eventBus = new EventBus();
    const callback = vi.fn();

    eventBus.onAll(callback);

    eventBus.emit(createSpawnEvent(1));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('зберігає останні 100 подій у правильному порядку без втрати останньої', () => {
    const eventBus = new EventBus();

    for (let i = 1; i <= EMITTED_EVENTS; i++) {
      eventBus.emit(createSpawnEvent(i));
    }

    const history = eventBus.getHistory();

    expect(history).toHaveLength(HISTORY_CAPACITY);
    expect((history[0] as EntitySpawnedEvent | undefined)?.id).toBe(createFoodId(`food-${String(FIRST_RETAINED_EVENT)}`));
    expect((history.at(-1) as EntitySpawnedEvent | undefined)?.id).toBe(createFoodId(`food-${String(EMITTED_EVENTS)}`));
    expect((eventBus.getLastEvent('EntitySpawned') as EntitySpawnedEvent | undefined)?.id).toBe(createFoodId(`food-${String(EMITTED_EVENTS)}`));
  });
});
