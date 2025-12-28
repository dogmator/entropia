/**
 * Entropia 3D — Система моделювання метаболічних процесів (Metabolism System).
 *
 * Відповідає за термодинамічний баланс організмів та розрахунок поточних енергетичних витрат:
 * - Базальний метаболізм (підтримка життєдіяльності в стані спокою).
 * - Локомоторні витрати (енергія, витрачена на кінетичну активність).
 * - Ресурсне забезпечення сенсорного апарату (пропорційно радіусу сприйняття).
 * - Алометричні залежності (вплив фізичного розміру на інтенсивність обміну речовин).
 * - Хронометрія біологічного старіння.
 */

import { METABOLIC_CONSTANTS, METABOLIC_THRESHOLDS } from '../../config';
import type { Organism } from '../Entity';

/**
 * Коефіцієнти метаболічної активності згідно з глобальними константами.
 */
const EXIST_COST_MULTIPLIER = METABOLIC_CONSTANTS.exist;
const MOVE_COST_MULTIPLIER = METABOLIC_CONSTANTS.move;
const SENSE_COST_MULTIPLIER = METABOLIC_CONSTANTS.sense;
const SIZE_COST_MULTIPLIER = METABOLIC_CONSTANTS.size;

/**
 * Структура деталізованого звіту про енергетичні витрати.
 */
export interface MetabolicBreakdown {
  existCost: number;
  moveCost: number;
  senseCost: number;
  sizeCost: number;
  totalCost: number;
}

/**
 * Клас, що реалізує термодинамічну модель функціонування агентів.
 */
export class MetabolismSystem {
  private currentTick: number = 0;

  /**
   * Кешований об'єкт MetabolicBreakdown для уникнення алокацій.
   * УВАГА: caller повинен скопіювати значення, якщо потрібно зберегти їх.
   */
  private readonly cachedBreakdown: MetabolicBreakdown = {
    existCost: 0,
    moveCost: 0,
    senseCost: 0,
    sizeCost: 0,
    totalCost: 0,
  };

  /**
   * Оновлення метаболічного стану для всієї біологічної популяції.
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
   * Обробка метаболічного циклу окремого організму.
   */
  private processMetabolism(org: Organism): void {
    const energyLoss = this.calculateEnergyLoss(org);

    // Дисипація внутрішньої енергії
    org.consumeEnergy(energyLoss);

    // Інкрементація біологічного віку (старіння)
    org.age++;

    // Реєстрація часової мітки останньої метаболічної активності
    org.lastActiveAt = this.currentTick;
  }

  /**
   * Розрахунок інтегральних енергетичних витрат.
   */
  private calculateEnergyLoss(org: Organism): number {
    this.fillBreakdown(org);
    return this.cachedBreakdown.totalCost;
  }

  /**
   * Заповнення кешованого об'єкта MetabolicBreakdown даними організму.
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
   * Генерація деталізованої декомпозиції метаболічних витрат.
   * УВАГА: повертає кешований об'єкт — caller повинен скопіювати, якщо потрібно зберегти.
   */
  getMetabolicBreakdown(org: Organism): MetabolicBreakdown {
    this.fillBreakdown(org);
    return this.cachedBreakdown;
  }

  /**
   * Розрахунок базального метаболізму.
   */
  private calculateExistCost(org: Organism): number {
    // Витрати масштабуються згідно з геометричним розміром (радіусом)
    return EXIST_COST_MULTIPLIER * org.radius * 0.5;
  }

  /**
   * Розрахунок теплових втрат внаслідок руху.
   */
  private calculateMoveCost(org: Organism): number {
    const velocitySquared =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    return MOVE_COST_MULTIPLIER * velocitySquared;
  }

  /**
   * Розрахунок вартості сенсорного сканування простору.
   */
  private calculateSenseCost(org: Organism): number {
    // Збільшення радіуса сприйняття експоненційно підвищує обчислювальні витрати
    return SENSE_COST_MULTIPLIER * org.genome.senseRadius * 0.01;
  }

  /**
   * Розрахунок енергії на підтримку генетично заданого розміру.
   */
  private calculateSizeCost(org: Organism): number {
    return SIZE_COST_MULTIPLIER * org.genome.size;
  }

  /**
   * Визначення дефіциту енергії (стан hunger).
   */
  isHungry(org: Organism): boolean {
    return org.normalizedEnergy < METABOLIC_THRESHOLDS.hunger;
  }

  /**
   * Визначення критичного рівня виснаження ( starvation ).
   */
  isCritical(org: Organism): boolean {
    return org.normalizedEnergy < METABOLIC_THRESHOLDS.critical;
  }

  /**
   * Прогноз тривалості життя за відсутності енергетичного підживлення.
   */
  estimateSurvivalTime(org: Organism): number {
    const breakdown = this.getMetabolicBreakdown(org);
    if (breakdown.totalCost <= 0) { return Infinity; }

    return Math.floor(org.energy / breakdown.totalCost);
  }

  /**
   * Ідентифікація досягнення стадії пізнього онтогенезу (старості).
   */
  isOld(org: Organism, maxAge: number): boolean {
    return org.age > maxAge * METABOLIC_THRESHOLDS.oldAgeRatio;
  }
}
