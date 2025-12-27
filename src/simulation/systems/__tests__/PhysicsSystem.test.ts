/**
 * Юніт-тести для PhysicsSystem.
 *
 * Верифікація:
 * - Інтеграція (update) для всіх не-мертвих організмів.
 * - Обмеження вектора швидкості/прискорення.
 * - Оновлення позиції в тороїдальному просторі.
 * - Застосування drag-коефіцієнта.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Genome, SimulationConfig, WorldConfig } from '@/types';
import { EntityType } from '@/types';

import { Organism } from '../../Entity';
import { PhysicsSystem } from '../PhysicsSystem';

/**
 * Мінімальна конфігурація для тестування.
 */
const createTestConfig = (): SimulationConfig => ({
    tickRate: 60,
    drag: 0.98,
    separationWeight: 1.5,
    cohesionWeight: 1.0,
    alignmentWeight: 1.0,
    seekWeight: 2.0,
    avoidWeight: 3.0,
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

/**
 * Мінімальний геном для тестування.
 */
const createTestGenome = (): Genome => ({
    id: 'test-genome',
    type: EntityType.PREY,
    subtype: 'default',
    size: 1,
    maxSpeed: 5,
    senseRadius: 30,
    metabolism: 1,
    color: 0x00ff00,
    mutationRate: 0.05,
    reproductionEnergy: 50,
    parentGenomeId: null,
});

describe('PhysicsSystem', () => {
    let physics: PhysicsSystem;
    let config: SimulationConfig;
    let worldConfig: WorldConfig;

    beforeEach(() => {
        config = createTestConfig();
        worldConfig = createWorldConfig();
        physics = new PhysicsSystem(config, worldConfig);
    });

    describe('update', () => {
        it('повинен обробляти всі живі організми', () => {
            const organisms = new Map<string, Organism>();
            const org1 = new Organism('org-1', { x: 10, y: 10, z: 10 }, createTestGenome());
            const org2 = new Organism('org-2', { x: 20, y: 20, z: 20 }, createTestGenome());
            const deadOrg = new Organism('org-dead', { x: 30, y: 30, z: 30 }, createTestGenome());
            deadOrg.die('starvation');

            organisms.set(org1.id, org1);
            organisms.set(org2.id, org2);
            organisms.set(deadOrg.id, deadOrg);

            // Додаємо прискорення
            org1.acceleration = { x: 1, y: 0, z: 0 };
            org2.acceleration = { x: 0, y: 1, z: 0 };

            physics.update(organisms);

            // Прискорення повинно скинутися до 0 після update
            expect(org1.acceleration.x).toBe(0);
            expect(org2.acceleration.y).toBe(0);

            // Мертвий організм не повинен оброблятися (прискорення залишається як було)
            deadOrg.acceleration = { x: 5, y: 5, z: 5 };
            physics.update(organisms);
            // Прискорення мертвого організму не скидається, бо update його ігнорує
            expect(deadOrg.acceleration.x).toBe(5);
        });
    });

    describe('velocity limiting', () => {
        it('повинен обмежувати швидкість до maxSpeed генома', () => {
            const organisms = new Map<string, Organism>();
            const genome = createTestGenome();
            genome.maxSpeed = 2;

            const org = new Organism('org-1', { x: 50, y: 50, z: 50 }, genome);
            org.acceleration = { x: 100, y: 100, z: 100 }; // Дуже велике прискорення

            organisms.set(org.id, org);
            physics.update(organisms);

            // Швидкість повинна бути обмежена до maxSpeed
            const speed = Math.sqrt(
                org.velocity.x ** 2 + org.velocity.y ** 2 + org.velocity.z ** 2
            );
            expect(speed).toBeLessThanOrEqual(genome.maxSpeed + 0.001);
        });
    });

    describe('toroidal wrapping', () => {
        it('повинен обгортати позицію при виході за межі світу', () => {
            const organisms = new Map<string, Organism>();
            const org = new Organism('org-1', { x: 99, y: 99, z: 99 }, createTestGenome());
            org.velocity = { x: 5, y: 5, z: 5 }; // Виведе за межі 100

            organisms.set(org.id, org);
            physics.update(organisms);

            // Позиція повинна обгорнутися в діапазон [0, 100)
            expect(org.position.x).toBeGreaterThanOrEqual(0);
            expect(org.position.x).toBeLessThan(worldConfig.WORLD_SIZE);
            expect(org.position.y).toBeGreaterThanOrEqual(0);
            expect(org.position.y).toBeLessThan(worldConfig.WORLD_SIZE);
        });

        it('повинен обгортати негативні координати', () => {
            const organisms = new Map<string, Organism>();
            const org = new Organism('org-1', { x: 2, y: 2, z: 2 }, createTestGenome());
            org.velocity = { x: -5, y: -5, z: -5 }; // Виведе в негативну область

            organisms.set(org.id, org);
            physics.update(organisms);

            // Позиція повинна обгорнутися з іншого боку
            expect(org.position.x).toBeGreaterThanOrEqual(0);
            expect(org.position.x).toBeLessThan(worldConfig.WORLD_SIZE);
        });
    });

    describe('drag application', () => {
        it('повинен зменшувати швидкість на коефіцієнт drag', () => {
            const organisms = new Map<string, Organism>();
            const org = new Organism('org-1', { x: 50, y: 50, z: 50 }, createTestGenome());
            org.velocity = { x: 1, y: 0, z: 0 };

            organisms.set(org.id, org);
            physics.update(organisms);

            // Швидкість повинна зменшитися на drag (0.98)
            expect(org.velocity.x).toBeLessThan(1);
            expect(org.velocity.x).toBeCloseTo(0.98, 2);
        });
    });

    describe('getKineticEnergy', () => {
        it('повинен розраховувати кінетичну енергію на основі швидкості та розміру', () => {
            const genome = createTestGenome();
            genome.size = 2;

            const org = new Organism('org-1', { x: 50, y: 50, z: 50 }, genome);
            org.velocity = { x: 3, y: 4, z: 0 }; // speed = 5

            const energy = physics.getKineticEnergy(org);

            // E = 0.5 * m * v^2 = 0.5 * 2 * 25 = 25
            expect(energy).toBeCloseTo(25, 5);
        });
    });
});
