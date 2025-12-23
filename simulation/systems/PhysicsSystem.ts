/**
 * Entropia 3D — Система моделювання фізичної динаміки (Physics System).
 *
 * Відповідає за кінематичний аналіз та інтегрування рівнянь руху біологічних агентів:
 * - Розрахунок вектору швидкості на основі накопиченого прискорення.
 * - Динамічне обмеження швидкості згідно з генетичним потенціалом організму.
 * - Оновлення просторових координат з урахуванням тороїдальної топології світу.
 * - Моделювання сил гідродинамічного опору (Drag forces).
 */

import { Organism } from '../Entity';
import { PHYSICS, WORLD_SIZE } from '../../constants';
import { MathUtils } from '../MathUtils';
import { SimulationConfig } from '../../types';

/**
 * Константи параметрів фізичної моделі.
 */
const MAX_STEERING_FORCE = PHYSICS.maxSteeringForce;

/**
 * Клас, що реалізує фізичний рушій симуляції.
 */
export class PhysicsSystem {
  constructor(
    private readonly config: SimulationConfig
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
  private integrate(org: Organism): void {
    // 1. Обмеження результуючої сили прискорення
    this.limitAcceleration(org);

    // 2. Інкрементальне оновлення вектора швидкості
    this.updateVelocity(org);

    // 3. Нормалізація швидкості згідно з генетичними лімітами
    this.limitVelocity(org);

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
    const accMagSq =
      org.acceleration.x * org.acceleration.x +
      org.acceleration.y * org.acceleration.y +
      org.acceleration.z * org.acceleration.z;

    if (accMagSq > MAX_STEERING_FORCE * MAX_STEERING_FORCE) {
      const accMag = Math.sqrt(accMagSq);
      const scale = MAX_STEERING_FORCE / accMag;
      org.acceleration.x *= scale;
      org.acceleration.y *= scale;
      org.acceleration.z *= scale;
    }
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
    const speedSq =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    const maxSpeedSq = org.genome.maxSpeed * org.genome.maxSpeed;

    if (speedSq > maxSpeedSq) {
      const speed = Math.sqrt(speedSq);
      const scale = org.genome.maxSpeed / speed;
      org.velocity.x *= scale;
      org.velocity.y *= scale;
      org.velocity.z *= scale;
    }
  }

  /**
   * Оновлення просторових координат з верифікацією тороїдальних меж.
   */
  private updatePosition(org: Organism): void {
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z);
  }

  /**
   * Застосування константи лінійного тертя середовища.
   */
  private applyDrag(org: Organism): void {
    const drag = this.config.drag;
    org.velocity.x *= drag;
    org.velocity.y *= drag;
    org.velocity.z *= drag;
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
