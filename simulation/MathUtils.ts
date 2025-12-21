
import { Vector3 } from '../types';
import { WORLD_SIZE } from '../constants';

export class MathUtils {
  static toroidalDistanceSq(a: Vector3, b: Vector3): number {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    let dz = Math.abs(a.z - b.z);
    if (dx > WORLD_SIZE / 2) dx = WORLD_SIZE - dx;
    if (dy > WORLD_SIZE / 2) dy = WORLD_SIZE - dy;
    if (dz > WORLD_SIZE / 2) dz = WORLD_SIZE - dz;
    return dx * dx + dy * dy + dz * dz;
  }

  static toroidalVector(from: Vector3, to: Vector3): Vector3 {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dz = to.z - from.z;
    
    if (dx > WORLD_SIZE / 2) dx -= WORLD_SIZE;
    if (dx < -WORLD_SIZE / 2) dx += WORLD_SIZE;
    if (dy > WORLD_SIZE / 2) dy -= WORLD_SIZE;
    if (dy < -WORLD_SIZE / 2) dy += WORLD_SIZE;
    if (dz > WORLD_SIZE / 2) dz -= WORLD_SIZE;
    if (dz < -WORLD_SIZE / 2) dz += WORLD_SIZE;
    
    return { x: dx, y: dy, z: dz };
  }

  static wrap(v: number): number {
    return (v % WORLD_SIZE + WORLD_SIZE) % WORLD_SIZE;
  }

  static limit(v: Vector3, max: number): Vector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq > max * max && magSq > 0) {
      const mag = Math.sqrt(magSq);
      return { x: (v.x / mag) * max, y: (v.y / mag) * max, z: (v.z / mag) * max };
    }
    return v;
  }

  static normalize(v: Vector3): Vector3 {
    const magSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (magSq < 0.000001) return { x: 0, y: 0, z: 0 };
    const mag = Math.sqrt(magSq);
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }
}
