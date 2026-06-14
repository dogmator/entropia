/**
 * Entropia 3D — Object behavior modeling system (Behavior System).
 *
 * Responsible for cognitive modeling of biological agents and calculating control vectors (Steering Behaviors):
 * - Classic Reynolds algorithm (Boids): separation, alignment, cohesion.
 * - Adaptive strategies: target pursuit (Seek), fleeing from threat (Flee), avoidance (Avoid).
 * - Sensory processing of environment to identify resources and predators.
 * - Behavior modulation depending on ecological zone parameters.
 */

import { PHYSICS } from '@/config';
import type { EcologicalZone, MutableVector3, OrganismState, SimulationConfig, Vector3, WorldConfig } from '@/types';
import { EntityType, type GridEntity } from '@/types';

import type { Organism } from '../Entity';
import type { GridManager } from '../managers/GridManager.manager';
import { MathUtils } from '../MathUtils.utils';

interface ZoneModifiers {
  seekMultiplier: number;
  dangerMultiplier: number;
}

export interface BehaviorOptions {
  config: SimulationConfig;
  zones: Map<string, EcologicalZone>;
  worldConfig: WorldConfig;
}

interface TargetInfo {
  pos: Vector3 | null;
  dist: number;
  state: OrganismState;
}

export class BehaviorSystem {
  private readonly worldSize: number;
  private readonly config: SimulationConfig;
  private readonly zones: Map<string, EcologicalZone>;

  private readonly forces = {
    separation: { x: 0, y: 0, z: 0, count: 0 },
    flee: { x: 0, y: 0, z: 0 },
    obstacle: { x: 0, y: 0, z: 0 },
  };

  private readonly cachedZoneMod: ZoneModifiers = { seekMultiplier: 1, dangerMultiplier: 1 };
  private readonly nearbyBuffer: GridEntity[] = [];
  private readonly scratchDiff: MutableVector3 = { x: 0, y: 0, z: 0 };
  private readonly scratchNav: MutableVector3 = { x: 0, y: 0, z: 0 };
  /** Sense radius of current organism being scanned — set once per scanNeighbors call. */
  private scanSenseRadius = 0;

  constructor(
    private readonly gridManager: GridManager,
    { config, zones, worldConfig }: BehaviorOptions,
  ) {
    this.config = config;
    this.zones = zones;
    this.worldSize = worldConfig.WORLD_SIZE;
  }

  public update(organisms: Map<string, Organism>): void {
    organisms.forEach(org => {
      if (!org.isDead) this.applyBehaviors(org);
    });
  }

  private applyBehaviors(org: Organism): void {
    this.gridManager.getNearby(org.position, org.genome.senseRadius, this.nearbyBuffer);
    this.resetForces();

    const { pos: target, state } = this.scanNeighbors(org);
    const zoneMod = this.getZoneModifier(org.position, org.type);
    const { separation, flee, obstacle } = this.forces;

    if (separation.count > 0) this.steer(org, separation, this.config.separationWeight);
    if (target) {
      MathUtils.toroidalVector(org.position, target, this.worldSize, this.scratchNav);
      this.steer(org, this.scratchNav, this.config.seekWeight * zoneMod.seekMultiplier);
    }
    this.steer(org, flee, this.config.avoidWeight);
    this.steer(org, obstacle, PHYSICS.OBSTACLE_AVOIDANCE_WEIGHT);
    org.updateState(state);
  }

  private scanNeighbors(org: Organism): TargetInfo {
    let best: TargetInfo = { pos: null, dist: Infinity, state: 'IDLE' };
    this.scanSenseRadius = org.genome.senseRadius;

    for (const n of this.nearbyBuffer) {
      if (n.id === org.id) continue;
      MathUtils.toroidalVector(org.position, n.position, this.worldSize, this.scratchDiff);
      const dist = Math.sqrt(MathUtils.magnitudeSq(this.scratchDiff));
      if (dist < PHYSICS.EPSILON) continue;

      if (this.deflectObstacle(n, org.radius, dist)) continue;
      this.separateFrom(dist);
      if (org.isPrey) best = this.scanAsPrey(n, dist, best);
      if (org.isPredator) best = this.scanAsPredator(n, dist, best);
    }

    return best;
  }

  /** Returns true if entity is an obstacle (skip further processing for this neighbor). */
  private deflectObstacle(entity: GridEntity, orgRadius: number, dist: number): boolean {
    if (entity.type !== EntityType.OBSTACLE) return false;
    if (dist < entity.radius + orgRadius + PHYSICS.obstacleAvoidanceDistance) {
      const force = 1 / (dist * dist);
      const f = this.forces.obstacle;
      const d = this.scratchDiff;
      f.x -= (d.x / dist) * force;
      f.y -= (d.y / dist) * force;
      f.z -= (d.z / dist) * force;
    }
    return true;
  }

  private separateFrom(dist: number): void {
    if (dist >= PHYSICS.separationRadius) return;
    const force = (PHYSICS.separationRadius - dist) / PHYSICS.separationRadius;
    const f = this.forces.separation;
    const d = this.scratchDiff;
    f.x -= (d.x / dist) * force;
    f.y -= (d.y / dist) * force;
    f.z -= (d.z / dist) * force;
    f.count++;
  }

  private scanAsPrey(entity: GridEntity, dist: number, best: TargetInfo): TargetInfo {
    if (entity.type === EntityType.FOOD && dist < best.dist) {
      return { pos: entity.position, dist, state: 'SEEKING' };
    }
    if (entity.type === EntityType.PREDATOR) {
      const force = this.scanSenseRadius / (dist * dist);
      const f = this.forces.flee;
      const d = this.scratchDiff;
      f.x -= (d.x / dist) * force;
      f.y -= (d.y / dist) * force;
      f.z -= (d.z / dist) * force;
      return { ...best, state: 'FLEEING' };
    }
    return best;
  }

  private scanAsPredator(entity: GridEntity, dist: number, best: TargetInfo): TargetInfo {
    if (entity.type === EntityType.PREY && dist < best.dist) {
      return { pos: entity.position, dist, state: 'HUNTING' };
    }
    return best;
  }

  private steer(org: Organism, vec: { x: number; y: number; z: number }, weight: number): void {
    const magSq = vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
    if (magSq > 0) {
      const mag = Math.sqrt(magSq);
      org.acceleration.x += (vec.x / mag) * weight;
      org.acceleration.y += (vec.y / mag) * weight;
      org.acceleration.z += (vec.z / mag) * weight;
    }
  }

  private getZoneModifier(pos: Vector3, type: EntityType): ZoneModifiers {
    const mod = this.cachedZoneMod;
    mod.seekMultiplier = 1;
    mod.dangerMultiplier = 1;
    this.zones.forEach(zone => {
      if (MathUtils.toroidalDistanceSq(pos, zone.center, this.worldSize) < zone.radius * zone.radius) {
        mod.seekMultiplier *= zone.foodMultiplier;
        mod.dangerMultiplier *= zone.dangerMultiplier;
      }
    });
    if (type === EntityType.PREDATOR) mod.seekMultiplier *= mod.dangerMultiplier;
    return mod;
  }

  private resetForces(): void {
    const f = this.forces;
    f.separation.x = f.separation.y = f.separation.z = 0;
    f.separation.count = 0;
    f.flee.x = f.flee.y = f.flee.z = 0;
    f.obstacle.x = f.obstacle.y = f.obstacle.z = 0;
  }
}
