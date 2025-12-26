/**
 * Entropia 3D — Система моделювання поведінки об'єктів (Behavior System).
 *
 * Відповідає за когнітивне моделювання біологічних агентів та розрахунок векторів керування (Steering Behaviors):
 * - Класичний алгоритм Рейнольдса (Boids): сепарація, вирівнювання, когезія.
 * - Адаптивні стратегії: переслідування цілі (Seek), втеча від загрози (Flee), ухилення (Avoid).
 * - Сенсорна обробка оточення для ідентифікації ресурсів та хижаків.
 * - Модуляція поведінки залежно від параметрів екологічних зон.
 */

import { Organism } from '../Entity';
import { EntityType, Vector3, EcologicalZone, SimulationConfig, OrganismState, WorldConfig } from '../../types';
import { SpatialHashGrid } from '../SpatialHashGrid';

/**
 * Константи параметрів поведінкової динаміки.
 */
import { PHYSICS } from '../../constants';
import { MathUtils } from '../MathUtils';

/**
 * Дескриптор модифікаторів поведінки в межах біома.
 */
interface ZoneModifiers {
  seekMultiplier: number;
  dangerMultiplier: number;
}

/**
 * Клас, що реалізує інтелектуальний рівень симуляції.
 */
export class BehaviorSystem {
  private readonly worldSize: number;

  constructor(
    private readonly spatialGrid: SpatialHashGrid,
    private readonly config: SimulationConfig,
    private readonly zones: Map<string, EcologicalZone>,
    private readonly worldConfig: WorldConfig
  ) {
    this.worldSize = worldConfig.WORLD_SIZE;
  }

  /**
   * Оновлення поведінкових векторів для всієї популяції.
   */
  update(organisms: Map<string, Organism>): void {
    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.applyBehaviors(organism);
      }
    });
  }

  /**
   * Розрахунок та застосування сумарних сил впливу на конкретний організм.
   */
  private applyBehaviors(org: Organism): void {
    const neighbors = this.spatialGrid.getNearby(org.position, org.genome.senseRadius);

    // Акумулятори векторних сил
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

    // Аналіз об'єктів у радіусі сенсорного сприйняття
    for (const n of neighbors) {
      if (n.id === org.id) continue;

      const diff = MathUtils.toroidalVector(org.position, n.position, this.worldSize);

      const distSq = MathUtils.magnitudeSq(diff);
      const dist = Math.sqrt(distSq);

      if (dist < 0.001) continue;

      const ndx = diff.x;
      const ndy = diff.y;
      const ndz = diff.z;
      // In toroidalVector: to - from.
      // So ndx is vector FROM org TO n.

      // Опрацювання просторових аномалій (перешкод)
      if (n.type === EntityType.OBSTACLE) {
        if (dist < n.radius + org.radius + PHYSICS.obstacleAvoidanceDistance) {
          const force = 1 / (dist * dist);
          forces.obstacle.x -= (ndx / dist) * force;
          forces.obstacle.y -= (ndy / dist) * force;
          forces.obstacle.z -= (ndz / dist) * force;
        }
        continue;
      }

      // Розрахунок сили сепарації (запобігання скупченню)
      if (dist < PHYSICS.separationRadius) {
        const force = (PHYSICS.separationRadius - dist) / PHYSICS.separationRadius;
        forces.separation.x -= (ndx / dist) * force;
        forces.separation.y -= (ndy / dist) * force;
        forces.separation.z -= (ndz / dist) * force;
        forces.separation.count++;
      }

      // Специфічна логіка для трофічного рівня травоїдних
      if (org.isPrey) {
        if (n.type === EntityType.FOOD && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = 'SEEKING';
        } else if (n.type === EntityType.PREDATOR) {
          const fleeForce = org.genome.senseRadius / (dist * dist);
          forces.flee.x -= (ndx / dist) * fleeForce;
          forces.flee.y -= (ndy / dist) * fleeForce;
          forces.flee.z -= (ndz / dist) * fleeForce;
          newState = 'FLEEING';
        }
      }

      // Специфічна логіка для трофічного рівня хижаків
      if (org.isPredator) {
        if (n.type === EntityType.PREY && dist < closestTargetDist) {
          closestTargetDist = dist;
          targetPos = n.position;
          newState = 'HUNTING';
        }
      }
    }

    // Отримання екологічних коефіцієнтів поточної локації
    const zoneModifier = this.getZoneModifier(org.position, org.type);

    // Застосування результуючих сил до вектора прискорення
    this.applySeparation(org, forces.separation, forces.separation.count);
    this.applySeek(org, forces.seek, targetPos, zoneModifier);
    this.applyFlee(org, forces.flee);
    this.applyObstacleAvoidance(org, forces.obstacle);

    // Актуалізація внутрішнього стану агента
    org.updateState(newState);
  }

  /**
   * Застосування сили сепарації (відштовхування сусідів).
   */
  private applySeparation(org: Organism, sep: { x: number; y: number; z: number }, count: number): void {
    if (count > 0) {
      this.applySteeringForce(org, sep, this.config.separationWeight);
    }
  }

  /**
   * Застосування сили переслідування цілі (Seek).
   */
  private applySeek(org: Organism, seek: { x: number; y: number; z: number }, target: Vector3 | null, mod: ZoneModifiers): void {
    if (!target) return;

    const nav = MathUtils.toroidalVector(org.position, target, this.worldSize);
    seek.x = nav.x;
    seek.y = nav.y;
    seek.z = nav.z;

    this.applySteeringForce(org, seek, this.config.seekWeight * mod.seekMultiplier);
  }

  /**
   * Застосування сили втечі від загрози (Flee).
   */
  private applyFlee(org: Organism, flee: { x: number; y: number; z: number }): void {
    this.applySteeringForce(org, flee, this.config.avoidWeight);
  }

  /**
   * Застосування сили ухилення від статичних об'єктів.
   */
  private applyObstacleAvoidance(org: Organism, obs: { x: number; y: number; z: number }): void {
    this.applySteeringForce(org, obs, 12);
  }

  /**
   * Універсальний метод застосування кермової сили.
   */
  private applySteeringForce(org: Organism, vector: { x: number; y: number; z: number }, weight: number): void {
    const magSq = vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
    if (magSq > 0) {
      const mag = Math.sqrt(magSq);
      org.acceleration.x += (vector.x / mag) * weight;
      org.acceleration.y += (vector.y / mag) * weight;
      org.acceleration.z += (vector.z / mag) * weight;
    }
  }

  /**
   * Розрахунок агрегованих модифікаторів біома для поточної локації.
   */
  private getZoneModifier(pos: Vector3, type: EntityType): ZoneModifiers {
    let seekMultiplier = 1;
    let dangerMultiplier = 1;

    this.zones.forEach(zone => {
      const distSq = MathUtils.toroidalDistanceSq(pos, zone.center, this.worldSize);

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
