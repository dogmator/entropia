/**
 * Entropia 3D — Фізична Система
 *
 * Відповідальність: Інтегрування руху організмів
 * - Оновлення швидкості на основі прискорення
 * - Обмеження швидкості згідно геному
 * - Оновлення позиції з тороїдальним простором
 * - Застосування сил тертя (drag)
 */

import { Organism } from '../Entity';
import { PHYSICS, WORLD_SIZE } from '../../constants';
import { MathUtils } from '../MathUtils';
import { SimulationConfig } from '../../types';

/**
 * Константи фізики (винесені для легкого налаштування)
 */
const MAX_STEERING_FORCE = PHYSICS.maxSteeringForce;

export class PhysicsSystem {
  constructor(
    private readonly config: SimulationConfig
  ) { }

  /**
   * Оновити фізику для всіх організмів
   */
  update(organisms: Map<string, Organism>): void {
    organisms.forEach(organism => {
      if (!organism.isDead) {
        this.integrate(organism);
      }
    });
  }

  /**
   * Інтегрувати рух одного організму
   */
  private integrate(org: Organism): void {
    // 1. Обмежити прискорення
    this.limitAcceleration(org);

    // 2. Оновити швидкість
    this.updateVelocity(org);

    // 3. Обмежити швидкість
    this.limitVelocity(org);

    // 4. Оновити позицію (тороїдальний простір)
    this.updatePosition(org);

    // 5. Застосувати тертя
    this.applyDrag(org);

    // 6. Скинути прискорення
    this.resetAcceleration(org);
  }

  /**
   * Обмежити прискорення до максимального значення
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
   * Оновити швидкість на основі прискорення
   */
  private updateVelocity(org: Organism): void {
    org.velocity.x += org.acceleration.x;
    org.velocity.y += org.acceleration.y;
    org.velocity.z += org.acceleration.z;
  }

  /**
   * Обмежити швидкість до максимальної згідно геному
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
   * Оновити позицію з тороїдальним простором
   */
  private updatePosition(org: Organism): void {
    org.position.x = MathUtils.wrap(org.position.x + org.velocity.x);
    org.position.y = MathUtils.wrap(org.position.y + org.velocity.y);
    org.position.z = MathUtils.wrap(org.position.z + org.velocity.z);
  }

  /**
   * Застосувати силу тертя (drag)
   */
  private applyDrag(org: Organism): void {
    const drag = this.config.drag;
    org.velocity.x *= drag;
    org.velocity.y *= drag;
    org.velocity.z *= drag;
  }

  /**
   * Скинути прискорення до нуля
   */
  private resetAcceleration(org: Organism): void {
    org.acceleration.x = 0;
    org.acceleration.y = 0;
    org.acceleration.z = 0;
  }

  /**
   * Розрахувати кінетичну енергію організму
   * (може використовуватись для візуалізації або балансу)
   */
  getKineticEnergy(org: Organism): number {
    const speedSq =
      org.velocity.x * org.velocity.x +
      org.velocity.y * org.velocity.y +
      org.velocity.z * org.velocity.z;

    // E = 1/2 * m * v^2 (припускаємо масу = розмір)
    return 0.5 * org.genome.size * speedSq;
  }
}
