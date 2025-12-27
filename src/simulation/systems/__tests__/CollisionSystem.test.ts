/**
 * Юніт-тести для CollisionSystem.
 *
 * Верифікація:
 * - Детекція перетину об'єктів (isColliding).
 * - Обробка колізій з їжею (handleFoodCollision).
 * - Обробка хижацтва (handlePredationCollision).
 * - Обробка колізій з перешкодами (handleObstacleCollision).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '@/core';
import type { Genome, WorldConfig } from '@/types';
import { EntityType } from '@/types';

import { Food, Obstacle, Organism } from '../../Entity';
import { SpatialHashGrid } from '../../SpatialHashGrid';
import { CollisionSystem } from '../CollisionSystem';

/**
 * Мінімальний геном для тестування.
 */
const createTestGenome = (type: EntityType = EntityType.PREY): Genome => ({
    id: 'test-genome',
    type,
    subtype: 'default',
    size: 1,
    maxSpeed: 5,
    senseRadius: 30,
    metabolism: 1,
    color: type === EntityType.PREY ? 0x00ff00 : 0xff0000,
    mutationRate: 0.05,
    reproductionEnergy: 50,
    parentGenomeId: null,
});

const createWorldConfig = (): WorldConfig => ({
    WORLD_SIZE: 100,
    HALF_WORLD_SIZE: 50,
    MAX_TOTAL_ORGANISMS: 500,
    INITIAL_PREY: 10,
    INITIAL_PREDATOR: 5,
    MAX_FOOD: 50,
    FOOD_SPAWN_RATE: 0.5,
});

describe('CollisionSystem', () => {
    let collisionSystem: CollisionSystem;
    let spatialGrid: SpatialHashGrid;
    let eventBus: EventBus;
    let worldConfig: WorldConfig;

    beforeEach(() => {
        worldConfig = createWorldConfig();
        spatialGrid = new SpatialHashGrid(worldConfig.WORLD_SIZE);
        eventBus = new EventBus();
        collisionSystem = new CollisionSystem(spatialGrid, eventBus);
    });

    describe('isColliding', () => {
        it('повинен повертати true при перетині радіусів', () => {
            // Два об'єкти на відстані 5, радіус кожного = 3, сума = 6 > 5
            const a = { position: { x: 0, y: 0, z: 0 }, radius: 3 };
            const b = { position: { x: 5, y: 0, z: 0 }, radius: 3 };

            // Доступаємося до приватного методу через any для тестування
            const result = (collisionSystem as unknown as { isColliding: typeof collisionSystem['isColliding'] })
            ['isColliding'](a, b);

            expect(result).toBe(true);
        });

        it('повинен повертати false коли об\'єкти не перетинаються', () => {
            // Два об'єкти на відстані 10, радіус кожного = 3, сума = 6 < 10
            const a = { position: { x: 0, y: 0, z: 0 }, radius: 3 };
            const b = { position: { x: 10, y: 0, z: 0 }, radius: 3 };

            const result = (collisionSystem as unknown as { isColliding: typeof collisionSystem['isColliding'] })
            ['isColliding'](a, b);

            expect(result).toBe(false);
        });
    });

    describe('handleFoodCollision', () => {
        it('повинен передавати енергію організму при поїданні їжі', () => {
            const organisms = new Map<string, Organism>();
            const food = new Map<string, Food>();
            const obstacles = new Map<string, Obstacle>();

            const prey = new Organism('prey-1', { x: 10, y: 10, z: 10 }, createTestGenome(EntityType.PREY));
            const foodItem = Food.create(1, 10.5, 10.5, 10.5); // Дуже близько до prey

            organisms.set(prey.id, prey);
            food.set(foodItem.id, foodItem);

            // Реєструємо їжу в spatial grid
            spatialGrid.insert(foodItem);

            const initialEnergy = prey.energy;

            collisionSystem.update(organisms, food, obstacles);

            // Енергія повинна збільшитись
            expect(prey.energy).toBeGreaterThan(initialEnergy);
            // Їжа повинна бути видалена
            expect(food.has(foodItem.id)).toBe(false);
        });

        it('хижаки не повинні їсти їжу', () => {
            const organisms = new Map<string, Organism>();
            const food = new Map<string, Food>();
            const obstacles = new Map<string, Obstacle>();

            const predator = new Organism('pred-1', { x: 10, y: 10, z: 10 }, createTestGenome(EntityType.PREDATOR));
            const foodItem = Food.create(1, 10.5, 10.5, 10.5);

            organisms.set(predator.id, predator);
            food.set(foodItem.id, foodItem);

            spatialGrid.insert(predator);
            spatialGrid.insert(foodItem);

            const initialEnergy = predator.energy;

            collisionSystem.update(organisms, food, obstacles);

            // Енергія не повинна змінитись
            expect(predator.energy).toBe(initialEnergy);
            // Їжа не повинна бути видалена
            expect(food.has(foodItem.id)).toBe(true);
        });
    });

    describe('handlePredationCollision', () => {
        it('повинен вбивати жертву при контакті з хижаком', () => {
            const organisms = new Map<string, Organism>();
            const food = new Map<string, Food>();
            const obstacles = new Map<string, Obstacle>();

            const predator = new Organism('pred-1', { x: 10, y: 10, z: 10 }, createTestGenome(EntityType.PREDATOR));
            const prey = new Organism('prey-1', { x: 10.5, y: 10.5, z: 10.5 }, createTestGenome(EntityType.PREY));

            organisms.set(predator.id, predator);
            organisms.set(prey.id, prey);

            spatialGrid.insert(predator);
            spatialGrid.insert(prey);

            const predatorInitialEnergy = predator.energy;

            const deadIds = collisionSystem.update(organisms, food, obstacles);

            // Жертва повинна бути мертва
            expect(prey.isDead).toBe(true);
            expect(deadIds).toContain(prey.id);

            // Хижак повинен отримати енергію
            expect(predator.energy).toBeGreaterThan(predatorInitialEnergy);
        });
    });

    describe('handleObstacleCollision', () => {
        it('повинен відбивати швидкість при зіткненні з перешкодою', () => {
            const organisms = new Map<string, Organism>();
            const food = new Map<string, Food>();
            const obstacles = new Map<string, Obstacle>();

            const prey = new Organism('prey-1', { x: 10, y: 10, z: 10 }, createTestGenome(EntityType.PREY));
            prey.velocity = { x: 5, y: 0, z: 0 }; // Рухається в напрямку перешкоди

            const obstacle = Obstacle.create(1, 12, 10, 10, 3); // Близько до prey

            organisms.set(prey.id, prey);
            obstacles.set(obstacle.id, obstacle);

            spatialGrid.insert(prey);
            spatialGrid.insert(obstacle);

            collisionSystem.update(organisms, food, obstacles);

            // Швидкість повинна змінитись (відбиття)
            // Точне значення залежить від реалізації, але напрямок повинен змінитись
            expect(prey.velocity.x).toBeLessThan(5);
        });
    });

    describe('event emission', () => {
        it('повинен емітувати подію при загибелі їжі', () => {
            const organisms = new Map<string, Organism>();
            const food = new Map<string, Food>();
            const obstacles = new Map<string, Obstacle>();

            const prey = new Organism('prey-1', { x: 10, y: 10, z: 10 }, createTestGenome(EntityType.PREY));
            const foodItem = Food.create(1, 10.5, 10.5, 10.5);

            organisms.set(prey.id, prey);
            food.set(foodItem.id, foodItem);

            spatialGrid.insert(prey);
            spatialGrid.insert(foodItem);

            const eventHandler = vi.fn();
            eventBus.on('EntityDied', eventHandler);

            collisionSystem.update(organisms, food, obstacles);

            expect(eventHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'EntityDied',
                    entityType: EntityType.FOOD,
                })
            );
        });
    });
});
