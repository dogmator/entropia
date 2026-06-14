import { logger } from '@/core';
import { Random } from '@/core';
import type { EcologicalZone, WorldConfig } from '@/types';
import { EntityType, ZoneType } from '@/types';

import { ENGINE_CONSTANTS, ZONE_DEFAULTS } from '../../config';
import { Obstacle } from '../Entity';
import type { EntityManager } from '../managers/EntityManager.manager';
import type { ReproductionSystem } from '../systems/Reproduction.system';
import type { SpawnService } from './Spawn.service';

interface InitialPopulationParams {
    spawnService: SpawnService;
    entityManager: EntityManager;
    reproductionSystem: ReproductionSystem;
    worldConfig: WorldConfig;
}

interface SpawnGroupParams {
    type: EntityType;
    count: number;
    spawnService: SpawnService;
    entityManager: EntityManager;
    reproductionSystem: ReproductionSystem;
}

export function buildZones(worldConfig: WorldConfig, zones: Map<string, EcologicalZone>): void {
    const ws = worldConfig.WORLD_SIZE;
    const centerMult = ENGINE_CONSTANTS.ZONE_CENTER_MULT;

    zones.set('oasis_center', {
        id: 'oasis_center',
        type: ZoneType.OASIS,
        center: { x: ws * centerMult, y: ws * centerMult, z: ws * centerMult },
        radius: ws * ENGINE_CONSTANTS.ZONE_OASIS_RADIUS_MULT,
        foodMultiplier: ZONE_DEFAULTS.OASIS.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.OASIS.dangerMultiplier,
    });

    const corners = [
        { x: 0, y: 0, z: 0 },
        { x: ws, y: ws, z: ws },
    ];
    corners.forEach((pos, i) => {
        zones.set(`desert_${String(i)}`, {
            id: `desert_${String(i)}`,
            type: ZoneType.DESERT,
            center: pos,
            radius: ws * ENGINE_CONSTANTS.ZONE_DESERT_RADIUS_MULT,
            foodMultiplier: ZONE_DEFAULTS.DESERT.foodMultiplier,
            dangerMultiplier: ZONE_DEFAULTS.DESERT.dangerMultiplier,
        });
    });

    zones.set('hunting_ground', {
        id: 'hunting_ground',
        type: ZoneType.HUNTING_GROUND,
        center: { x: ws * ENGINE_CONSTANTS.ZONE_HUNTING_X_MULT, y: ws * centerMult, z: ws * ENGINE_CONSTANTS.ZONE_HUNTING_Z_MULT },
        radius: ws * ENGINE_CONSTANTS.ZONE_HUNTING_RADIUS_MULT,
        foodMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.HUNTING_GROUND.dangerMultiplier,
    });

    zones.set('sanctuary', {
        id: 'sanctuary',
        type: ZoneType.SANCTUARY,
        center: { x: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_X_MULT, y: ws * centerMult, z: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_Z_MULT },
        radius: ws * ENGINE_CONSTANTS.ZONE_SANCTUARY_RADIUS_MULT,
        foodMultiplier: ZONE_DEFAULTS.SANCTUARY.foodMultiplier,
        dangerMultiplier: ZONE_DEFAULTS.SANCTUARY.dangerMultiplier,
    });
}

export function buildObstacles(worldConfig: WorldConfig, entityManager: EntityManager, counterStart: number): number {
    let counter = counterStart;
    const count = ENGINE_CONSTANTS.OBSTACLE_COUNT;
    for (let i = 0; i < count; i++) {
        const radius = ENGINE_CONSTANTS.OBSTACLE_MIN_RADIUS + Random.next() * ENGINE_CONSTANTS.OBSTACLE_RADIUS_RANGE;
        const obstacle = Obstacle.create(
            ++counter,
            Random.next() * worldConfig.WORLD_SIZE,
            Random.next() * worldConfig.WORLD_SIZE,
            Random.next() * worldConfig.WORLD_SIZE,
            radius
        );
        entityManager.addObstacle(obstacle);
    }
    return counter;
}

export function buildInitialPopulation(params: InitialPopulationParams): void {
    const { spawnService, entityManager, reproductionSystem, worldConfig } = params;
    spawnGroup({
        type: EntityType.PREY,
        count: worldConfig.INITIAL_PREY,
        spawnService,
        entityManager,
        reproductionSystem
    });
    spawnGroup({
        type: EntityType.PREDATOR,
        count: worldConfig.INITIAL_PREDATOR,
        spawnService,
        entityManager,
        reproductionSystem
    });
}

function spawnGroup(params: SpawnGroupParams): void {
    const { type, count, spawnService, entityManager, reproductionSystem } = params;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
        const organism = spawnService.spawnOrganism(type);
        if (organism) {
            entityManager.addOrganism(organism);
            reproductionSystem.addToGeneticTree(organism);
            spawned++;
        }
    }
    logger.info(`Spawned ${String(spawned)}/${String(count)} entities of type ${type}`, 'Engine');
}
