/**
 * EVOSIM 3D — Система Поведінки
 *
 * Відповідальність: AI та поведінка організмів
 * - Boids алгоритм (separation, alignment, cohesion)
 * - Steering behaviors (seek, flee, avoid)
 * - Виявлення цілей та загроз
 * - Модифікатори від екологічних зон
 */

import { Organism } from '../Entity';
import { EntityType, Vector3, EcologicalZone, SimulationConfig, OrganismState } from '../../types';
import { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Константи поведінки
 */
const SEPARATION_RADIUS = 18;
const OBSTACLE_AVOIDANCE_DISTANCE = 25;

/**
 * Модифікатори від зони
 */
interface ZoneModifiers {
  seekMultiplier: number;
  dangerMultiplier: number;
}

export class BehaviorSystem {
  constructor(
    private readonly spatialGrid: SpatialHashGrid,
    private readonly config: SimulationConfig,
    private readonly zones: Map<string, EcologicalZone>
  ) {}

  /**
   * Оновити поведінку всіх організмів
   */
  update(organisms: Map<string, Organism>): void {
    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.applyBehaviors(organism);
      }
    });
  }

  /**
   * Застосувати поведінкові сили до організму
   */
  private applyBehaviors(org: Organism): void {
    const neighbors = this.spatialGrid.getNearby(org.position, org.genome.senseRadius);

    // Накопичувачі сил
    const forces = {
      separation: { x: 0, y: 0, z: 0, count: 0 },
      seek: { x: 0, y: 0, z: 0 },
      flee: { x: 0, y: 0, z: 0 },
      obstacle: { x: 0, y: 0, z: 0 },
      alignment: { x: 0, y: 0, z: 0, count: 0 },
    };

    let closestTargetDist = Infinity;
    let targetPos: Vector3 | null = null;
    let newState: OrganismState = 'IDLE';

    // Обробити всіх сусідів
    for (const n of neighbors) {
      if (n.id === org.id) continue;

      const dx = n.position.x - org.position.x;
      const dy = n.position.y - org.position.y;
      const dz = n.position.z - org.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      if (dist < 0.001) continue;

      // Уникання перешкод
      if (n.type === EntityType.OBSTACLE) {
        if (dist < n.radius + org.radius + OBSTACLE_AVOIDANCE_DISTANCE) {
          const force = 1 / (dist * dist);
          forces.obstacle.x -= (dx / dist) * force;
          forces.obstacle.y -= (dy / dist) * force;
          forces.obstacle.z -= (dz / dist) * force;
        }
        continue;
      }

      // Сепарація
      if (dist < SEPARATION_RADIUS) {
        const force = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
        forces.separation.x -= (dx / dist) * force;
        forces.separation.y -= (dy / dist) * force;
        forces.separation.z -= (dz / dist) * force;
        forces.separation.count++;
      }

      // Поведінка травоїдних
      if (org.isPrey) {
        if (n.type === EntityType.FOOD && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = 'SEEKING';
        } else if (n.type === EntityType.PREDATOR) {
          const fleeForce = org.genome.senseRadius / (dist * dist);
          forces.flee.x -= (dx / dist) * fleeForce;
          forces.flee.y -= (dy / dist) * fleeForce;
          forces.flee.z -= (dz / dist) * fleeForce;
          newState = 'FLEEING';
        }
      }

      // Поведінка хижаків
      if (org.isPredator) {
        if (n.type === EntityType.PREY && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = 'HUNTING';
        }
      }
    }

    // Застосувати зони
    const zoneModifier = this.getZoneModifier(org.position, org.type);

    // Застосувати сили
    this.applySeparation(org, forces.separation, forces.separation.count);
    this.applySeek(org, forces.seek, targetPos, zoneModifier);
    this.applyFlee(org, forces.flee);
    this.applyObstacleAvoidance(org, forces.obstacle);

    // Оновити стан
    org.updateState(newState);
  }

  /**
   * Застосувати силу сепарації
   */
  private applySeparation(org: Organism, sep: { x: number; y: number; z: number }, count: number): void {
    if (count === 0) return;

    const mag = Math.sqrt(sep.x * sep.x + sep.y * sep.y + sep.z * sep.z);
    if (mag > 0) {
      org.acceleration.x += (sep.x / mag) * this.config.separationWeight;
      org.acceleration.y += (sep.y / mag) * this.config.separationWeight;
      org.acceleration.z += (sep.z / mag) * this.config.separationWeight;
    }
  }

  /**
   * Застосувати силу пошуку
   */
  private applySeek(org: Organism, seek: { x: number; y: number; z: number }, target: Vector3 | null, mod: ZoneModifiers): void {
    if (!target) return;

    seek.x = target.x - org.position.x;
    seek.y = target.y - org.position.y;
    seek.z = target.z - org.position.z;

    const mag = Math.sqrt(seek.x * seek.x + seek.y * seek.y + seek.z * seek.z);
    if (mag > 0) {
      const weight = this.config.seekWeight * mod.seekMultiplier;
      org.acceleration.x += (seek.x / mag) * weight;
      org.acceleration.y += (seek.y / mag) * weight;
      org.acceleration.z += (seek.z / mag) * weight;
    }
  }

  /**
   * Застосувати силу втечі
   */
  private applyFlee(org: Organism, flee: { x: number; y: number; z: number }): void {
    const mag = Math.sqrt(flee.x * flee.x + flee.y * flee.y + flee.z * flee.z);
    if (mag > 0) {
      org.acceleration.x += (flee.x / mag) * this.config.avoidWeight;
      org.acceleration.y += (flee.y / mag) * this.config.avoidWeight;
      org.acceleration.z += (flee.z / mag) * this.config.avoidWeight;
    }
  }

  /**
   * Застосувати силу уникання перешкод
   */
  private applyObstacleAvoidance(org: Organism, obs: { x: number; y: number; z: number }): void {
    const mag = Math.sqrt(obs.x * obs.x + obs.y * obs.y + obs.z * obs.z);
    if (mag > 0) {
      org.acceleration.x += (obs.x / mag) * 12;
      org.acceleration.y += (obs.y / mag) * 12;
      org.acceleration.z += (obs.z / mag) * 12;
    }
  }

  /**
   * Отримати модифікатори зони
   */
  private getZoneModifier(pos: Vector3, type: EntityType): ZoneModifiers {
    let seekMultiplier = 1;
    let dangerMultiplier = 1;

    this.zones.forEach(zone => {
      const dx = pos.x - zone.center.x;
      const dy = pos.y - zone.center.y;
      const dz = pos.z - zone.center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < zone.radius * zone.radius) {
        seekMultiplier *= zone.foodMultiplier;
        dangerMultiplier *= zone.dangerMultiplier;
      }
    });

    if (type === EntityType.PREDATOR) {
      seekMultiplier *= dangerMultiplier;
    }

    return { seekMultiplier, dangerMultiplier };
  }
}
