/**
 * Entropia 3D — Система моделювання фізичної динаміки (Physics System).
 *
 * Відповідає за кінематичний аналіз та інтегрування рівнянь руху біологічних агентів:
 * - Розрахунок вектору швидкості на основі накопиченого прискорення.
 * - Динамічне обмеження швидкості згідно з генетичним потенціалом організму.
 * - Оновлення просторових координат з урахуванням тороїдальної топології світу.
 * - Моделювання сил гідродинамічного опору (Drag forces).
 */

import type { WorldConfig } from '@/types';

import type { Organism } from '../Entity';
import { MathUtils } from '../MathUtils';

/**
 * Константи параметрів фізичної моделі.
 */
const MAX_STEERING_FORCE = 50;

/**
 * Клас, що реалізує фізичний рушій симуляції.
 */
export class PhysicsSystem {
  constructor(
    private readonly worldConfig: WorldConfig
  ) { }

  /**
   * Оновлення фізичного стану для всієї популяції.
   */
  update(organisms: Map<string, Organism>): void {
    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.integrate(organism);
      }
    });
  }

  /**
   * Виконання ітерації числового інтегрування для одного об'єкта.
   */
  /**
   * Виконання ітерації числового інтегрування для одного об'єкта.
   */
  private integrate(org: Organism): void {
    // 1. Обмеження результуючої сили прискорення
    this.limitAcceleration(org);

    // 2. Інкрементальне оновлення вектора швидкості
    this.updateVelocity(org);

    // 3. Нормалізація швидкості згідно з генетичним потенціалом
    this.limitVelocity(org);

    // Validation: Check for NaN velocity
    if (Number.isNaN(org.velocity.x) || Number.isNaN(org.velocity.y) || Number.isNaN(org.velocity.z)) {
      console.error(`PhysicsSystem: NaN velocity detected for organism ${org.id}`);
      org.velocity.x = 0;
      org.velocity.y = 0;
      org.velocity.z = 0;
    }

    // 4. Трансляція позиції у тороїдальному просторі
    this.updatePosition(org);

    // 5. Моделювання дисипації енергії через опір середовища
    this.applyDrag(org);

    // 6. Скидання акумулятора прискорення для наступного ітераційного циклу
    this.resetAcceleration(org);
  }

  /**
   * Обмеження магнітуди вектора прискорення (визначення межі фізичної сили).
   */
  private limitAcceleration(org: Organism): void {
    this.limitVector(org.acceleration, MAX_STEERING_FORCE);
  }

  /**
   * Актуалізація вектора швидкості на основі поточної сили (прискорення).
   */
  private updateVelocity(org: Organism): void {
    org.velocity.x += org.acceleration.x;
    org.velocity.y += org.acceleration.y;
    org.velocity.z += org.acceleration.z;
  }

  /**
   * Регулювання швидкості згідно з індивідуальними характеристиками організму.
   */
  private limitVelocity(org: Organism): void {
    // Hard cap max speed to 3.0 effectively as requested
    const effectiveMaxSpeed = Math.min(org.genome.maxSpeed, 3.0);
    this.limitVector(org.velocity, effectiveMaxSpeed);
  }

  /**
   * Універсальний помічник для обмеження магнітуди вектора.
   */
  private limitVector(v: import('@/types').MutableVector3, max: number): void {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq > max * max && magSq > 0) {
      const scale = max / Math.sqrt(magSq);
      v.x *= scale;
      v.y *= scale;
      v.z *= scale;
    }
  }

  /**
   * Оновлення просторових координат з верифікацією тороїдальних меж.
   */
  private updatePosition(org: Organism): void {
    const ws = this.worldConfig.WORLD_SIZE;
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x, ws);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y, ws);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z, ws);
  }

  /**
   * Застосування константи лінійного тертя середовища.
   */
  private applyDrag(org: Organism): void {
    const DRAG_COEFFICIENT = 0.96;
    org.velocity.x *= DRAG_COEFFICIENT;
    org.velocity.y *= DRAG_COEFFICIENT;
    org.velocity.z *= DRAG_COEFFICIENT;
  }

  /**
   * Онулення вектора сил для підготовки до нового циклу обчислень.
   */
  private resetAcceleration(org: Organism): void {
    org.acceleration.x = 0;
    org.acceleration.y = 0;
    org.acceleration.z = 0;
  }

  /**
   * Розрахунок поточної кінетичної енергії агента.
   */
  getKineticEnergy(org: Organism): number {
    const speedSq =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    // E = 0.5 * m * v^2 (де m еквівалентно параметру size геному)
    return 0.5 * org.genome.size * speedSq;
  }
}
