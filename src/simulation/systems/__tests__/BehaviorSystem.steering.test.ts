/**
 * Юніт-тести для BehaviorSystem — розширені тести для steering behaviors.
 *
 * Верифікація:
 * - Застосування сили сепарації.
 * - Застосування сили переслідування (Seek).
 * - Застосування сили втечі (Flee).
 * - Розрахунок ZoneModifiers.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { EcologicalZone, Genome, SimulationConfig, WorldConfig, PreyGenome, PredatorGenome } from '../../../types';
import { createOrganismId, EntityType, ZoneType, createGenomeId, PredatorSubtype } from '../../../types';

import { Organism } from '../../Entity';
import { GridManager } from '../../managers/GridManager';
import { BehaviorSystem } from '../BehaviorSystem';

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
const createTestGenome = (type: EntityType = EntityType.PREY): Genome => {
    const base = {
        id: createGenomeId('test-genome'),
        generation: 1,
        color: type === EntityType.PREY ? 0x00ff00 : 0xff0000,
        maxSpeed: 5,
        senseRadius: 30,
        metabolism: 1,
        size: 1,
        asymmetry: 0,
        spikiness: 0,
        glowIntensity: 0.5,
        parentId: null,
    };

    if (type === EntityType.PREDATOR) {
        return {
            ...base,
            type: EntityType.PREDATOR,
            subtype: PredatorSubtype.HUNTER,
            attackPower: 10,
            packAffinity: 0.5,
        } as PredatorGenome;
    }

    return {
        ...base,
        type: EntityType.PREY,
        flockingStrength: 0.5,
    } as PreyGenome;
};

describe('BehaviorSystem — Steering Behaviors', () => {
    let behavior: BehaviorSystem;
    let gridManager: GridManager;
    let config: SimulationConfig;
    let worldConfig: WorldConfig;
    let zones: Map<string, EcologicalZone>;

    beforeEach(() => {
        config = createTestConfig();
        worldConfig = createWorldConfig();
        gridManager = new GridManager(worldConfig.WORLD_SIZE, 50);
        zones = new Map();
        behavior = new BehaviorSystem(gridManager, config, zones, worldConfig);
    });

    describe('separation force', () => {
        it('повинен розділяти близьких сусідів', () => {
            const organisms = new Map<string, Organism>();

            // Два організми дуже близько один до одного
            const org1 = new Organism(createOrganismId('org-1'), { x: 50, y: 50, z: 50 }, createTestGenome());
            const org2 = new Organism(createOrganismId('org-2'), { x: 51, y: 50, z: 50 }, createTestGenome());

            organisms.set(org1.id, org1);
            organisms.set(org2.id, org2);

            gridManager.rebuild(organisms, new Map());
            // Static grid should be initialized if needed, but here we only have organisms
            gridManager.initializeStatic(new Map());
            gridManager.rebuild(organisms, new Map());

            behavior.update(organisms);

            // org1 повинен мати прискорення в негативному напрямку X (від org2)
            expect(org1.acceleration.x).toBeLessThan(0);
            // org2 повинен мати прискорення в позитивному напрямку X (від org1)
            expect(org2.acceleration.x).toBeGreaterThan(0);
        });
    });

    describe('seek force', () => {
        it('травоїдний повинен рухатись до їжі', () => {
            const organisms = new Map<string, Organism>();

            const prey = new Organism(createOrganismId('prey-1'), { x: 50, y: 50, z: 50 }, createTestGenome(EntityType.PREY));
            organisms.set(prey.id, prey);

            // Їжа справа від prey
            const food = {
                id: 'food-1',
                position: { x: 60, y: 50, z: 50 },
                type: EntityType.FOOD,
                radius: 1,
            };

            const foodMap = new Map();
            foodMap.set(food.id, food);
            gridManager.initializeStatic(new Map());
            gridManager.rebuild(organisms, foodMap);

            behavior.update(organisms);

            // prey повинен мати прискорення в напрямку їжі (позитивний X)
            expect(prey.acceleration.x).toBeGreaterThan(0);
        });
    });

    describe('flee force', () => {
        it('жертва повинна тікати від хижака', () => {
            const organisms = new Map<string, Organism>();

            const prey = new Organism(createOrganismId('prey-1'), { x: 50, y: 50, z: 50 }, createTestGenome(EntityType.PREY));
            const predator = new Organism(createOrganismId('pred-1'), { x: 55, y: 50, z: 50 }, createTestGenome(EntityType.PREDATOR));

            organisms.set(prey.id, prey);
            organisms.set(predator.id, predator);

            gridManager.initializeStatic(new Map());
            gridManager.rebuild(organisms, new Map());

            behavior.update(organisms);

            // prey повинен мати прискорення від хижака (негативний X, бо хижак справа)
            expect(prey.acceleration.x).toBeLessThan(0);
        });
    });

    describe('zone modifiers', () => {
        it('повинен застосовувати модифікатори зони на поведінку', () => {
            // Створюємо зону з високим foodMultiplier
            const fertileZone: EcologicalZone = {
                id: 'test_oasis',
                type: ZoneType.OASIS,
                center: { x: 50, y: 50, z: 50 },
                radius: 30,
                foodMultiplier: 2.0,
                dangerMultiplier: 1.0,
            };

            zones.set(fertileZone.id, fertileZone);

            // Новий behavior з зоною
            behavior = new BehaviorSystem(gridManager, config, zones, worldConfig);

            const organisms = new Map<string, Organism>();
            const prey = new Organism(createOrganismId('prey-1'), { x: 50, y: 50, z: 50 }, createTestGenome(EntityType.PREY));
            organisms.set(prey.id, prey);

            // Їжа в зоні
            const food = {
                id: 'food-1',
                position: { x: 55, y: 50, z: 50 },
                type: EntityType.FOOD,
                radius: 1,
            };

            const foodMap = new Map();
            foodMap.set(food.id, food);
            gridManager.initializeStatic(new Map());
            gridManager.rebuild(organisms, foodMap);

            behavior.update(organisms);

            // prey повинен рухатись до їжі з посиленою силою (x2 seekMultiplier)
            expect(prey.acceleration.x).toBeGreaterThan(0);
            // Абсолютне значення має бути значним через модифікатор
            expect(Math.abs(prey.acceleration.x)).toBeGreaterThan(1);
        });
    });

    describe('dead organisms', () => {
        it('не повинен обробляти мертві організми', () => {
            const organisms = new Map<string, Organism>();

            const deadOrg = new Organism(createOrganismId('dead-1'), { x: 50, y: 50, z: 50 }, createTestGenome());
            deadOrg.die('starvation');

            organisms.set(deadOrg.id, deadOrg);
            gridManager.rebuild(organisms, new Map());

            behavior.update(organisms);

            // Прискорення мертвого організму повинно залишитись 0
            expect(deadOrg.acceleration.x).toBe(0);
            expect(deadOrg.acceleration.y).toBe(0);
            expect(deadOrg.acceleration.z).toBe(0);
        });
    });
});
