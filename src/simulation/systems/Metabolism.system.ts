/**
 * Entropia 3D — Metabolism modeling system (Metabolism System).
 *
 * Responsible for thermodynamic balance of organisms and calculating current energy costs:
 * - Basal metabolism (maintenance of life in resting state).
 * - Locomotor costs (energy spent on kinetic activity).
 * - Resource provision for sensory apparatus (proportional to perception radius).
 * - Allometric dependencies (impact of physical size on metabolic rate).
 * - Chronometry of biological aging.
 */

import { METABOLIC_CONSTANTS, METABOLIC_THRESHOLDS } from '../../config';
import { logger } from '@/core';
import type { Organism } from '../Entity';

/**
 * Metabolic activity coefficients according to global constants.
 */
const EXIST_COST_MULTIPLIER = METABOLIC_CONSTANTS.exist;
const MOVE_COST_MULTIPLIER = METABOLIC_CONSTANTS.move;
const SENSE_COST_MULTIPLIER = METABOLIC_CONSTANTS.sense;
const SIZE_COST_MULTIPLIER = METABOLIC_CONSTANTS.size;

/** Scale factor for basal costs relative to organism radius. */
const EXIST_RADIUS_SCALE = 0.5;
/** Scale factor for sensory costs relative to perception radius. */
const SENSE_RADIUS_SCALE = 0.01;

/**
 * Detailed energy cost report structure.
 */
export interface MetabolicBreakdown {
  existCost: number;
  moveCost: number;
  senseCost: number;
  sizeCost: number;
  totalCost: number;
}

/**
 * Class implementing the thermodynamic model of agent functioning.
 */
export class MetabolismSystem {
  private currentTick = 0;

  /**
   * Cached MetabolicBreakdown object to avoid allocations.
   * WARNING: caller must copy values if they need to be preserved.
   */
  private readonly cachedBreakdown: MetabolicBreakdown = {
    existCost: 0,
    moveCost: 0,
    senseCost: 0,
    sizeCost: 0,
    totalCost: 0,
  };

  /**
   * Updating metabolic state for the entire biological population.
   */
  public update(organisms: Map<string, Organism>, tick: number): void {
    this.currentTick = tick;

    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.processMetabolism(organism);
      }
    });

    if (tick % 120 === 0 && organisms.size > 0) {
      let minR = Infinity, maxR = 0, sumR = 0, count = 0;
      organisms.forEach(o => { if (!o.isDead) { minR = Math.min(minR, o.radius); maxR = Math.max(maxR, o.radius); sumR += o.radius; count++; } });
      logger.debug(`Organism radius: min=${String(minR.toFixed(2))} max=${String(maxR.toFixed(2))} avg=${String((sumR/count).toFixed(2))} n=${String(count)}`, 'MetabolismSystem');
    }
  }

  /**
   * Processing metabolic cycle of an individual organism.
   */
  private processMetabolism(org: Organism): void {
    const energyLoss = this.calculateEnergyLoss(org);

    // Dissipation of internal energy
    org.consumeEnergy(energyLoss);

    // Increment biological age (aging)
    org.age++;
    org.updateGrowthFromState();

    // Last metabolic activity timestamp registration
    org.lastActiveAt = this.currentTick;
  }

  /**
   * Integral energy cost calculation.
   */
  private calculateEnergyLoss(org: Organism): number {
    this.fillBreakdown(org);
    return this.cachedBreakdown.totalCost;
  }

  /**
   * Filling cached MetabolicBreakdown object with organism data.
   */
  private fillBreakdown(org: Organism): void {
    const b = this.cachedBreakdown;
    b.existCost = this.calculateExistCost(org);
    b.moveCost = this.calculateMoveCost(org);
    b.senseCost = this.calculateSenseCost(org);
    b.sizeCost = this.calculateSizeCost(org);
    b.totalCost = (b.existCost + b.moveCost + b.senseCost + b.sizeCost) * org.genome.metabolism;
  }

  /**
   * Generating detailed metabolic cost decomposition.
   * WARNING: returns cached object — caller must copy if preservation is needed.
   */
  public getMetabolicBreakdown(org: Organism): MetabolicBreakdown {
    this.fillBreakdown(org);
    return this.cachedBreakdown;
  }

  /**
   * Basal metabolism calculation.
   */
  private calculateExistCost(org: Organism): number {
    // Costs scale according to geometric size (radius)
    return EXIST_COST_MULTIPLIER * org.radius * EXIST_RADIUS_SCALE;
  }

  /**
   * Calculation of heat loss due to movement.
   */
  private calculateMoveCost(org: Organism): number {
    const velocitySquared =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    return MOVE_COST_MULTIPLIER * velocitySquared;
  }

  /**
   * Sensory space scanning cost calculation.
   */
  private calculateSenseCost(org: Organism): number {
    // Increasing perception radius exponentially increases computational costs
    return SENSE_COST_MULTIPLIER * org.genome.senseRadius * SENSE_RADIUS_SCALE;
  }

  /**
   * Calculation of energy for maintaining genetically determined size.
   */
  private calculateSizeCost(org: Organism): number {
    return SIZE_COST_MULTIPLIER * org.genome.size;
  }

  /**
   * Determination of energy deficit (hunger state).
   */
  public isHungry(org: Organism): boolean {
    return org.normalizedEnergy < METABOLIC_THRESHOLDS.hunger;
  }

  /**
   * Determination of critical exhaustion level ( starvation ).
   */
  public isCritical(org: Organism): boolean {
    return org.normalizedEnergy < METABOLIC_THRESHOLDS.critical;
  }

  /**
   * Life expectancy forecast in absence of energy replenishment.
   */
  public estimateSurvivalTime(org: Organism): number {
    const breakdown = this.getMetabolicBreakdown(org);
    if (breakdown.totalCost <= 0) { return Infinity; }

    return Math.floor(org.energy / breakdown.totalCost);
  }

  /**
   * Identification of reaching late ontogenesis stage (old age).
   */
  public isOld(org: Organism, maxAge: number): boolean {
    return org.age > maxAge * METABOLIC_THRESHOLDS.oldAgeRatio;
  }
}
