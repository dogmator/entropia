/**
 * Entropia 3D — Система Метаболізму
 *
 * Відповідальність: Обробка витрат енергії організмів
 * - Базовий метаболізм (витрати на існування)
 * - Витрати на рух
 * - Витрати на сенсори (радіус зору)
 * - Витрати залежно від розміру
 * - Старіння організмів
 */

import { Organism } from '../Entity';
import { METABOLIC_CONSTANTS } from '../../constants';

/**
 * Константи метаболізму
 */
const EXIST_COST_MULTIPLIER = METABOLIC_CONSTANTS.exist;
const MOVE_COST_MULTIPLIER = METABOLIC_CONSTANTS.move;
const SENSE_COST_MULTIPLIER = METABOLIC_CONSTANTS.sense;
const SIZE_COST_MULTIPLIER = METABOLIC_CONSTANTS.size;

/**
 * Детальна інформація про витрати енергії
 */
export interface MetabolicBreakdown {
  existCost: number;
  moveCost: number;
  senseCost: number;
  sizeCost: number;
  totalCost: number;
}

export class MetabolismSystem {
  private currentTick: number = 0;

  /**
   * Оновити метаболізм для всіх організмів
   */
  update(organisms: Map<string, Organism>, tick: number): void {
    this.currentTick = tick;

    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.processMetabolism(organism);
      }
    });
  }

  /**
   * Обробити метаболізм одного організму
   */
  private processMetabolism(org: Organism): void {
    const energyLoss = this.calculateEnergyLoss(org);

    // Витратити енергію
    org.consumeEnergy(energyLoss);

    // Збільшити вік
    org.age++;

    // Оновити час останньої активності
    org.lastActiveAt = this.currentTick;
  }

  /**
   * Розрахувати витрати енергії
   */
  private calculateEnergyLoss(org: Organism): number {
    const breakdown = this.getMetabolicBreakdown(org);
    return breakdown.totalCost;
  }

  /**
   * Отримати детальний розклад витрат енергії
   */
  getMetabolicBreakdown(org: Organism): MetabolicBreakdown {
    // Витрати на існування (базовий метаболізм)
    const existCost = this.calculateExistCost(org);

    // Витрати на рух (квадрат швидкості)
    const moveCost = this.calculateMoveCost(org);

    // Витрати на сенсори
    const senseCost = this.calculateSenseCost(org);

    // Витрати на підтримку розміру
    const sizeCost = this.calculateSizeCost(org);

    // Загальна сума з урахуванням ефективності метаболізму
    const totalCost = (existCost + moveCost + senseCost + sizeCost) * org.genome.metabolism;

    return {
      existCost,
      moveCost,
      senseCost,
      sizeCost,
      totalCost,
    };
  }

  /**
   * Розрахувати базові витрати на існування
   */
  private calculateExistCost(org: Organism): number {
    // Витрати пропорційні радіусу (більший організм = більше витрат)
    return EXIST_COST_MULTIPLIER * org.radius * 0.5;
  }

  /**
   * Розрахувати витрати на рух
   */
  private calculateMoveCost(org: Organism): number {
    const velocitySquared =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    return MOVE_COST_MULTIPLIER * velocitySquared;
  }

  /**
   * Розрахувати витрати на сенсори
   */
  private calculateSenseCost(org: Organism): number {
    // Більший радіус зору = більше витрат на обробку інформації
    return SENSE_COST_MULTIPLIER * org.genome.senseRadius * 0.01;
  }

  /**
   * Розрахувати витрати на підтримку розміру
   */
  private calculateSizeCost(org: Organism): number {
    return SIZE_COST_MULTIPLIER * org.genome.size;
  }

  /**
   * Перевірити чи організм потребує їжі
   * (може використовуватись для AI або візуалізації)
   */
  isHungry(org: Organism): boolean {
    return org.normalizedEnergy < 0.5;
  }

  /**
   * Перевірити чи організм в критичному стані
   */
  isCritical(org: Organism): boolean {
    return org.normalizedEnergy < 0.2;
  }

  /**
   * Розрахувати очікуваний час виживання без їжі
   * (в тіках)
   */
  estimateSurvivalTime(org: Organism): number {
    const breakdown = this.getMetabolicBreakdown(org);
    if (breakdown.totalCost <= 0) return Infinity;

    return Math.floor(org.energy / breakdown.totalCost);
  }

  /**
   * Перевірити чи організм старий
   * (може використовуватись для ризику смерті від старості)
   */
  isOld(org: Organism, maxAge: number): boolean {
    return org.age > maxAge * 0.8;
  }
}
