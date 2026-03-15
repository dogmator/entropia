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

import type { Genome, SimulationConfig, WorldConfig } from '../../../types';
import { createOrganismId, EntityType, createGenomeId } from '../../../types';

import { Organism } from '../../Entity';
import { PhysicsSystem } from '../PhysicsSystem';

/**
 * Мінімальна конфігурація для тестування.
 */
const createTestConfig = (): SimulationConfig => ({
    drag: 0.98,
    separationWeight: 1.5,
    cohesionWeight: 1.0,
    alignmentWeight: 1.0,
    seekWeight: 2.0,
    avoidWeight: 3.0,
    foodSpawnRate: 0.1,
    maxFood: 100,
    maxOrganisms: 500,
    showObstacles: true,
    mutationFactor: 0.1,
    reproductionThreshold: 100,
    organismOpacity: 1,
    foodOpacity: 1,
    organismScale: 1,
    foodScale: 1,
    bloomIntensity: 1,
    showGrid: true,
    gridOpacity: 0.5,
    trailLength: 10,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'HIGH',
});

const createWorldConfig = (): WorldConfig => ({
    WORLD_SIZE: 100,
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
    id: createGenomeId('test-genome'),
    type: EntityType.PREY,
    size: 1,
    maxSpeed: 5,
    senseRadius: 30,
    metabolism: 1,
    color: 0x00ff00,
    parentId: null,
    generation: 1,
    asymmetry: 0,
    spikiness: 0,
    glowIntensity: 0.5,
    flockingStrength: 0.5,
});

describe('PhysicsSystem', () => {
    let physics: PhysicsSystem;
    let config: SimulationConfig;
    let worldConfig: WorldConfig;

    beforeEach(() => {
        worldConfig = createWorldConfig();
        physics = new PhysicsSystem(worldConfig);
    });

    describe('update', () => {
        it('повинен обробляти всі живі організми', () => {
            const organisms = new Map<string, Organism>();
            const org1 = new Organism(createOrganismId('org-1'), { x: 10, y: 10, z: 10 }, createTestGenome());
            const org2 = new Organism(createOrganismId('org-2'), { x: 20, y: 20, z: 20 }, createTestGenome());
            const deadOrg = new Organism(createOrganismId('org-dead'), { x: 30, y: 30, z: 30 }, createTestGenome());
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
        it('повинен обмежувати швидкість згідно з maxSpeed геному', () => {
            const organisms = new Map<string, Organism>();
            const genome = createTestGenome();
            (genome as { maxSpeed: number }).maxSpeed = 2;

            const organism = new Organism(createOrganismId('org-1'), { x: 50, y: 50, z: 50 }, genome);
            organisms.set(organism.id, organism);

            const highSpeedVector = { x: 10, y: 0, z: 0 };
            organism.velocity.x = highSpeedVector.x;
            organism.velocity.y = highSpeedVector.y;
            organism.velocity.z = highSpeedVector.z;

            // maxSpeed is read-only, use unknown cast for test override
            (organism as unknown as { genome: { maxSpeed: number } }).genome.maxSpeed = 2;

            // PhysicsSystem сам не обробляє колізії, але він повинен коректно 
            // працювати з сутностями будь-якого радіусу
            (organism as unknown as { radius: number }).radius = 10;

            physics.update(organisms);

            const speed = Math.sqrt(
                organism.velocity.x ** 2 +
                organism.velocity.y ** 2 +
                organism.velocity.z ** 2
            );
            expect(speed).toBeLessThanOrEqual(genome.maxSpeed + 0.0001);
        });
    });

    describe('toroidal wrapping', () => {
        it('повинен обгортати позицію при виході за межі світу', () => {
            const organisms = new Map<string, Organism>();
            const org = new Organism(createOrganismId('org-1'), { x: 99, y: 99, z: 99 }, createTestGenome());
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
            const org = new Organism(createOrganismId('org-1'), { x: 2, y: 2, z: 2 }, createTestGenome());
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
            const org = new Organism(createOrganismId('org-1'), { x: 50, y: 50, z: 50 }, createTestGenome());
            org.velocity = { x: 1, y: 0, z: 0 };

            organisms.set(org.id, org);
            physics.update(organisms);

            // Швидкість повинна зменшитися на drag (0.96)
            expect(org.velocity.x).toBeLessThan(1);
            expect(org.velocity.x).toBeCloseTo(0.96, 2);
        });
    });

    describe('getKineticEnergy', () => {
        it('повинен розраховувати кінетичну енергію на основі швидкості та розміру', () => {
            const genome = createTestGenome();
            (genome as { size: number }).size = 2;

            const org = new Organism(createOrganismId('org-1'), { x: 50, y: 50, z: 50 }, genome);
            org.velocity = { x: 3, y: 4, z: 0 }; // speed = 5

            const energy = physics.getKineticEnergy(org);

            // E = 0.5 * m * v^2 = 0.5 * 2 * 25 = 25
            expect(energy).toBeCloseTo(25, 5);
        });
    });
});
