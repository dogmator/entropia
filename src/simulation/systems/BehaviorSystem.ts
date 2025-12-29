/**
 * Entropia 3D — Система моделювання поведінки об'єктів (Behavior System).
 *
 * Відповідає за когнітивне моделювання біологічних агентів та розрахунок векторів керування (Steering Behaviors):
 * - Класичний алгоритм Рейнольдса (Boids): сепарація, вирівнювання, когезія.
 * - Адаптивні стратегії: переслідування цілі (Seek), втеча від загрози (Flee), ухилення (Avoid).
 * - Сенсорна обробка оточення для ідентифікації ресурсів та хижаків.
 * - Модуляція поведінки залежно від параметрів екологічних зон.
 */

/**
 * Константи параметрів поведінкової динаміки.
 */
import { PHYSICS } from '@/config';
import type { GridManager } from '../managers/GridManager';
import { EntityType } from '@/types';
import type { EcologicalZone, OrganismState, SimulationConfig, Vector3, WorldConfig } from '@/types.ts';

import type { Organism } from '../Entity';
import { MathUtils } from '../MathUtils';

const _diff = { x: 0, y: 0, z: 0 };
const _nav = { x: 0, y: 0, z: 0 };

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

  /** Кешовані акумулятори сил для уникнення алокацій на кожному тіку. */
  private readonly forceAccumulators = {
    separation: { x: 0, y: 0, z: 0, count: 0 },
    seek: { x: 0, y: 0, z: 0 },
    flee: { x: 0, y: 0, z: 0 },
    obstacle: { x: 0, y: 0, z: 0 },
    alignment: { x: 0, y: 0, z: 0, count: 0 },
  };

  /** Кешований ZoneModifiers для уникнення алокацій. */
  private readonly cachedZoneModifiers: ZoneModifiers = {
    seekMultiplier: 1,
    dangerMultiplier: 1,
  };

  constructor(
    private readonly gridManager: GridManager,
    private readonly config: SimulationConfig,
    private readonly zones: Map<string, EcologicalZone>,
    worldConfig: WorldConfig
  ) {
    this.worldSize = worldConfig.WORLD_SIZE;
  }

  /**
   * Скидання акумуляторів сил до нульових значень.
   */
  private resetForces(): void {
    const f = this.forceAccumulators;
    f.separation.x = f.separation.y = f.separation.z = 0;
    f.separation.count = 0;
    f.seek.x = f.seek.y = f.seek.z = 0;
    f.flee.x = f.flee.y = f.flee.z = 0;
    f.obstacle.x = f.obstacle.y = f.obstacle.z = 0;
    f.alignment.x = f.alignment.y = f.alignment.z = 0;
    f.alignment.count = 0;
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
    const neighbors = this.gridManager.getNearby(org.position, org.genome.senseRadius);

    // Скидання кешованих акумуляторів
    this.resetForces();
    const forces = this.forceAccumulators;

    let closestTargetDist = Infinity;
    let targetPos: Vector3 | null = null;
    let newState: OrganismState = 'IDLE';



    // Аналіз об'єктів у радіусі сенсорного сприйняття
    for (const n of neighbors) {
      if (n.id === org.id) { continue; }

      // Use scratch vector _diff
      MathUtils.toroidalVector(org.position, n.position, this.worldSize, _diff);

      const distSq = MathUtils.magnitudeSq(_diff);
      const dist = Math.sqrt(distSq);

      if (dist < PHYSICS.EPSILON) { continue; }

      const ndx = _diff.x;
      const ndy = _diff.y;
      const ndz = _diff.z;
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
    if (!target) { return; }

    // Use scratch vector _nav
    MathUtils.toroidalVector(org.position, target, this.worldSize, _nav);
    seek.x = _nav.x;
    seek.y = _nav.y;
    seek.z = _nav.z;

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
    this.applySteeringForce(org, obs, PHYSICS.OBSTACLE_AVOIDANCE_WEIGHT);
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
    const mod = this.cachedZoneModifiers;
    mod.seekMultiplier = 1;
    mod.dangerMultiplier = 1;

    this.zones.forEach(zone => {
      const distSq = MathUtils.toroidalDistanceSq(pos, zone.center, this.worldSize);

      if (distSq < zone.radius * zone.radius) {
        mod.seekMultiplier *= zone.foodMultiplier;
        mod.dangerMultiplier *= zone.dangerMultiplier;
      }
    });

    if (type === EntityType.PREDATOR) {
      mod.seekMultiplier *= mod.dangerMultiplier;
    }

    return mod;
  }
}
