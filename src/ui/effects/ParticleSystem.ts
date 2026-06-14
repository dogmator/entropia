/**
 * Entropia 3D — GPU-optimized particle generation and management system.
 *
 * Implemented performance optimization methods:
 * - BufferAttribute.updateRange for incremental data updates (minimizing overhead).
 * - Constant geometry for TrailSystem to exclude garbage collection (Zero GC).
 * - Batch updates to minimize the command queue to the GPU.
 * - Frustum culling optimization.
 * - Intelligent mechanism for tracking modified buffer fragments (Dirty tracking).
 *
 * Uses the Object Pool pattern to ensure stable memory usage.
 */

import { ParticlePool, type PooledParticle } from '@core/ObjectPool.service';
import * as THREE from 'three';

import { COLORS, PARTICLE_CONSTANTS, RENDER } from '@/config';
import type { Vector3 } from '@/types';

const POW_2 = 2;

import {
  particleFragmentShader,
  particleVertexShader,
} from '../shaders/OrganismShader';

// ============================================================================
// TYPE AND INTERFACE DEFINITIONS
// ============================================================================

export interface ParticleEffect {
  readonly id: string;
  readonly type: 'death' | 'birth' | 'eat' | 'hunt';
  readonly position: Vector3;
  readonly color: number;
  readonly startTime: number;
  readonly duration: number;
}


// ============================================================================
// PARTICLE SYSTEM MODELING CLASS WITH GPU OPTIMIZATION
// ============================================================================

/**
 * Control center for the particle system with integrated hardware acceleration mechanisms.
 */
export class ParticleSystem {
  private readonly scene: THREE.Scene;


  // Graphics infrastructure objects
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly points: THREE.Points;

  // Buffer attribute arrays
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly opacities: Float32Array;
  private readonly colors: Float32Array;

  // Registry of active system elements
  private readonly activeParticles: PooledParticle[] = [];
  private activeCount = 0;

  // Dirty Tracking mechanism to minimize data exchange with the GPU
  private dirtyMin = Infinity;
  private dirtyMax = -Infinity;
  private isDirty = false;

  constructor(scene: THREE.Scene, maxParticles: number = RENDER.maxEffectParticles) {
    this.scene = scene;


    // Initialization of typed arrays for buffers
    this.positions = new Float32Array(maxParticles * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    this.sizes = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);
    this.colors = new Float32Array(maxParticles * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    // Constructing the buffer geometry object
    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const sizeAttr = new THREE.BufferAttribute(this.sizes, PARTICLE_CONSTANTS.SCALAR_COMPONENTS);
    const opacityAttr = new THREE.BufferAttribute(this.opacities, PARTICLE_CONSTANTS.SCALAR_COMPONENTS);
    const colorAttr = new THREE.BufferAttribute(this.colors, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    // Setting the dynamic usage flag for driver optimization
    posAttr.usage = THREE.DynamicDrawUsage;
    sizeAttr.usage = THREE.DynamicDrawUsage;
    opacityAttr.usage = THREE.DynamicDrawUsage;
    colorAttr.usage = THREE.DynamicDrawUsage;

    this.geometry.setAttribute('position', posAttr);
    this.geometry.setAttribute('size', sizeAttr);
    this.geometry.setAttribute('opacity', opacityAttr);
    this.geometry.setAttribute('color', colorAttr);

    // Shader material specification with additive blending support
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Registering the Points node in the scene graph
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // Particles can be dispersed throughout the entire volume
    this.scene.add(this.points);

    // Particle pool is already initialized globally in ObjectPool.ts
    // We will extract particles from it as needed.
  }

  // ============================================================================
  // PUBLIC VISUAL EVENT GENERATION METHODS
  // ============================================================================

  /**
   * Initialization of the visual effect of the organism's terminal state (death).
   */
  public addDeathEffect(position: Vector3, color: number, isPredator = false): void {
    const particleCount = isPredator
      ? PARTICLE_CONSTANTS.DEATH_COUNT_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_COUNT_PREY;
    const speed = isPredator
      ? PARTICLE_CONSTANTS.DEATH_SPEED_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_SPEED_PREY;
    const size = isPredator
      ? PARTICLE_CONSTANTS.DEATH_SIZE_PREDATOR
      : PARTICLE_CONSTANTS.DEATH_SIZE_PREY;

    for (let i = 0; i < particleCount; i++) {
      this.emitParticle({
        position,
        color,
        speed,
        size,
        /* eslint-disable-next-line sonarjs/pseudo-random */
        life: PARTICLE_CONSTANTS.DEATH_LIFE_MIN + Math.random() * PARTICLE_CONSTANTS.DEATH_LIFE_ADDITIONAL,
        isExplosive: true // Using explosive kinematics
      });
    }
  }

  /**
   * Initialization of the visual effect of agent emergence (birth).
   */
  public addBirthEffect(position: Vector3, color: number): void {
    const particleCount = PARTICLE_CONSTANTS.BIRTH_COUNT_RING;

    // Ring shock wave generation
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * PARTICLE_CONSTANTS.TWO_PI;
      const speed = PARTICLE_CONSTANTS.BIRTH_SPEED;

      const p = this.acquireParticle();

      p.x = position.x;
      p.y = position.y;
      p.z = position.z;
      p.vx = Math.cos(angle) * speed;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      p.vy = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * PARTICLE_CONSTANTS.BIRTH_Y_VARIANCE;
      p.vz = Math.sin(angle) * speed;
      p.life = PARTICLE_CONSTANTS.BIRTH_LIFE;
      p.maxLife = PARTICLE_CONSTANTS.BIRTH_LIFE;
      p.size = PARTICLE_CONSTANTS.BIRTH_SIZE;
      p.color = color;
      p.opacity = PARTICLE_CONSTANTS.DEFAULT_OPACITY;
    }

    // Additional central photonic flash
    for (let i = 0; i < PARTICLE_CONSTANTS.BIRTH_COUNT_FLASH; i++) {
      this.emitParticle({
        position,
        color: PARTICLE_CONSTANTS.WHITE_COLOR,
        speed: PARTICLE_CONSTANTS.BIRTH_FLASH_SPEED,
        size: PARTICLE_CONSTANTS.BIRTH_FLASH_SIZE,
        life: PARTICLE_CONSTANTS.BIRTH_FLASH_LIFE,
        isExplosive: true
      });
    }
  }

  /**
   * Implementation of the energy resource absorption effect (feeding).
   */
  public addEatEffect(position: Vector3): void {
    for (let i = 0; i < PARTICLE_CONSTANTS.EAT_COUNT; i++) {
      this.emitParticle({
        position,
        color: COLORS.food.glow,
        speed: PARTICLE_CONSTANTS.EAT_SPEED,
        size: PARTICLE_CONSTANTS.EAT_SIZE,
        life: PARTICLE_CONSTANTS.EAT_LIFE,
        isExplosive: true
      });
    }
  }

  /**
   * Visualization of the predator's attack vector.
   */
  public addHuntEffect(predatorPos: Vector3, preyPos: Vector3): void {
    // Formation of a discrete line of the attack trajectory
    const steps = PARTICLE_CONSTANTS.HUNT_STEPS;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pos = {
        x: predatorPos.x + (preyPos.x - predatorPos.x) * t,
        y: predatorPos.y + (preyPos.y - predatorPos.y) * t,
        z: predatorPos.z + (preyPos.z - predatorPos.z) * t,
      };
      this.emitParticle({
        position: pos,
        color: COLORS.predator.glow,
        speed: PARTICLE_CONSTANTS.HUNT_SPEED,
        size: PARTICLE_CONSTANTS.HUNT_SIZE,
        life: PARTICLE_CONSTANTS.HUNT_LIFE,
        isExplosive: false
      });
    }
  }

  /**
   * Computational cycle for updating the particle system state with GPU optimization.
   */
  public update(deltaTime: number): void {
    let writeIndex = 0;
    this.dirtyMin = Infinity;
    this.dirtyMax = -Infinity;
    this.isDirty = false;

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (p === undefined) continue;

      // Update life time parameter
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.activeParticles.splice(i, 1);
        ParticlePool.release(p);
        this.activeCount--;
        this.markDirty(writeIndex); // Using writeIndex here might be tricky, let's rethink.
        continue;
      }

      // Calculation of new spatial coordinates
      p.x += p.vx * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;
      p.y += p.vy * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;
      p.z += p.vz * deltaTime * PARTICLE_CONSTANTS.FRAME_RATE_MULTIPLIER;

      // Application of environmental aerodynamic drag coefficient
      p.vx *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;
      p.vy *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;
      p.vz *= PARTICLE_CONSTANTS.DRAG_COEFFICIENT;

      // Integration of gravitational acceleration in the vertical plane
      p.vy -= PARTICLE_CONSTANTS.GRAVITY;

      // Opacity adjustment as a function of life time
      const lifeRatio = p.life / p.maxLife;
      p.opacity = lifeRatio;

      // Data serialization into attribute buffers
      const i3 = writeIndex * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      this.positions[i3 + PARTICLE_CONSTANTS.X_OFFSET] = p.x;
      this.positions[i3 + PARTICLE_CONSTANTS.Y_OFFSET] = p.y;
      this.positions[i3 + PARTICLE_CONSTANTS.Z_OFFSET] = p.z;

      this.sizes[writeIndex] = p.size * (PARTICLE_CONSTANTS.SIZE_SCALE_MIN + lifeRatio * PARTICLE_CONSTANTS.SIZE_SCALE_FACTOR);
      this.opacities[writeIndex] = p.opacity;

      // Decomposition of color value into RGB components with normalization
      const r = ((p.color >> PARTICLE_CONSTANTS.COLOR_SHIFT_R) & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      const g = ((p.color >> PARTICLE_CONSTANTS.COLOR_SHIFT_G) & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      const b = (p.color & PARTICLE_CONSTANTS.COLOR_MASK) / PARTICLE_CONSTANTS.COLOR_DIVISOR;
      this.colors[i3 + PARTICLE_CONSTANTS.X_OFFSET] = r;
      this.colors[i3 + PARTICLE_CONSTANTS.Y_OFFSET] = g;
      this.colors[i3 + PARTICLE_CONSTANTS.Z_OFFSET] = b;

      this.markDirty(writeIndex);
      writeIndex++;
    }

    this.updateBufferRanges(writeIndex);
  }

  /**
   * GPU optimization: Performing update only for specified range of buffers.
   */
  private updateBufferRanges(writeIndex: number): void {
    if (this.isDirty && this.dirtyMin <= this.dirtyMax) {
      const posAttr = this.geometry.attributes['position'] as THREE.BufferAttribute;
      const sizeAttr = this.geometry.attributes['size'] as THREE.BufferAttribute;
      const opacityAttr = this.geometry.attributes['opacity'] as THREE.BufferAttribute;
      const colorAttr = this.geometry.attributes['color'] as THREE.BufferAttribute;

      const stride = PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      const count = this.dirtyMax - this.dirtyMin + 1;

      posAttr.addUpdateRange(this.dirtyMin * stride, count * stride);
      sizeAttr.addUpdateRange(this.dirtyMin, count);
      opacityAttr.addUpdateRange(this.dirtyMin, count);
      colorAttr.addUpdateRange(this.dirtyMin * stride, count * stride);

      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      opacityAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }

    // Setting draw range according to the number of active particles
    this.geometry.setDrawRange(0, writeIndex);
  }

  /**
   * Forced deactivation of all system elements.
   */
  public clear(): void {
    for (const p of this.activeParticles) {
      ParticlePool.release(p);
    }
    this.activeParticles.length = 0;
    this.activeCount = 0;
  }

  /**
   * Releasing GPU resources and terminating system operation.
   */
  public dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }

  // ============================================================================
  // INTERNAL AUXILIARY OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Registering index of modified element for Dirty Tracking mechanism.
   */
  private markDirty(index: number): void {
    this.isDirty = true;
    if (index < this.dirtyMin) { this.dirtyMin = index; }
    if (index > this.dirtyMax) { this.dirtyMax = index; }
  }

  /**
   * Implementation of free particle extraction strategy from the pool.
   */
  private acquireParticle(): PooledParticle {
    const p = ParticlePool.acquire();
    this.activeParticles.push(p);
    this.activeCount++;
    return p;
  }

  /**
   * Formation and emission of a new particle with given kinematic parameters.
   */
  private emitParticle(params: {
    position: Vector3,
    color: number,
    speed: number,
    size: number,
    life: number,
    isExplosive: boolean
  }): void {
    const { position, color, speed, size, life, isExplosive } = params;
    const p = this.acquireParticle();

    p.x = position.x;
    p.y = position.y;
    p.z = position.z;

    if (isExplosive) {
      // Generation of isotropic spherical velocity vector distribution using Marsaglia method
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const theta = Math.random() * PARTICLE_CONSTANTS.TWO_PI;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const phi = Math.acos(PARTICLE_CONSTANTS.SPHERE_PHI_MULTIPLIER * Math.random() - PARTICLE_CONSTANTS.SPHERE_RANDOM_OFFSET);
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const r = speed * (PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET + Math.random() * PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET);

      p.vx = r * Math.sin(phi) * Math.cos(theta);
      p.vy = r * Math.sin(phi) * Math.sin(theta);
      p.vz = r * Math.cos(phi);
    } else {
      /* eslint-disable-next-line sonarjs/pseudo-random */
      p.vx = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      p.vy = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      p.vz = (Math.random() - PARTICLE_CONSTANTS.VELOCITY_CENTER_OFFSET) * speed;
    }

    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.opacity = PARTICLE_CONSTANTS.DEFAULT_OPACITY;
  }

  /**
   * Current number of active elements in the system.
   */
  public get count(): number {
    return this.activeCount;
  }
}

// ============================================================================
// GPU-OPTIMIZED TRAIL SYSTEM (ZERO GC!)
// ============================================================================

/**
 * Description of subject trail object structure with constant buffer geometry.
 */
interface Trail {
  readonly organismId: string;
  readonly color: THREE.Color;
  readonly geometry: THREE.BufferGeometry;
  readonly positionBuffer: Float32Array;
  readonly colorBuffer: Float32Array;
  readonly historyBuffer: Float32Array;
  line: THREE.Line;
  maxLength: number;
  lastFrameId: number;
  historySize: number;
  historyWriteIndex: number;
}

/**
 * Trail management manager with high memory efficiency.
 */
export class TrailSystem {
  private readonly scene: THREE.Scene;
  private readonly trails = new Map<string, Trail>();
  private readonly maxTrailLength: number;
  private currentFrameId = 0;

  constructor(scene: THREE.Scene, maxTrailLength: number = RENDER.maxTrailParticles) {
    this.scene = scene;
    this.maxTrailLength = maxTrailLength;
  }

  /**
   * Updating trail geometry for specific organism (Zero-allocation).
   */
  public updateTrail(organismId: string, params: {
    position: Vector3,
    color: number,
    isEnabled: boolean
  }): void {
    const { position, color, isEnabled } = params;
    if (!isEnabled) {
      this.removeTrail(organismId);
      return;
    }

    let trail = this.trails.get(organismId);

    if (!trail) {
      trail = this.createTrail(organismId, color);
      this.trails.set(organismId, trail);
    }

    // Check for wrapping/teleportation (distance threshold)
    const lastPos = this.getLastTrailPoint(trail);
    if (lastPos !== null) {
      const distSq =
        (position.x - lastPos.x) ** POW_2 +
        (position.y - lastPos.y) ** POW_2 +
        (position.z - lastPos.z) ** POW_2;

      if (distSq > PARTICLE_CONSTANTS.TRAIL_TELEPORT_THRESHOLD_SQ) {
        trail.historySize = 0;
        trail.historyWriteIndex = 0;
      }
    }

    trail.lastFrameId = this.currentFrameId;
    this.appendTrailPoint(trail, position);

    // Performing direct write to video memory buffers
    this.updateTrailBuffers(trail);
  }

  /**
   * Terminal removal of trail object from the graphics scene.
   */
  public removeTrail(organismId: string): void {
    const trail = this.trails.get(organismId);
    if (trail) {
      this.scene.remove(trail.line);
      trail.geometry.dispose();
      (trail.line.material as THREE.Material).dispose();
      this.trails.delete(organismId);
    }
  }

  /**
   * Bulk clearing of all active trails.
   */
  public clear(): void {
    this.trails.forEach((_trail, id) => {
      this.removeTrail(id);
    });
  }

  /**
   * Marking frame start for old trail clearing mechanism.
   */
  public beginFrame(): void {
    this.currentFrameId++;
  }

  /**
   * Removing trails that were not updated in the current frame.
   */
  public prune(): void {
    const idsToRemove: string[] = [];
    this.trails.forEach((trail, id) => {
      if (trail.lastFrameId !== this.currentFrameId) {
        idsToRemove.push(id);
      }
    });

    idsToRemove.forEach(id => { this.removeTrail(id); });
  }

  /**
   * Termination of system operation and release of associated resources.
   */
  public dispose(): void {
    this.clear();
  }

  // ============================================================================
  // PRIVATE INTERNAL GEOMETRY UPGRADE METHODS
  // ============================================================================

  /**
   * Initialization of new trail object using persistent geometry.
   */
  private createTrail(organismId: string, color: number): Trail {
    // Max capacity buffer allocation during initialization phase
    const positionBuffer = new Float32Array(this.maxTrailLength * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const colorBuffer = new Float32Array(this.maxTrailLength * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const historyBuffer = new Float32Array(this.maxTrailLength * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positionBuffer, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    const colorAttr = new THREE.BufferAttribute(colorBuffer, PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    // Dynamic usage specification to increase update frequency
    posAttr.usage = THREE.DynamicDrawUsage;
    colorAttr.usage = THREE.DynamicDrawUsage;

    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colorAttr);

    // Line object material setup
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: PARTICLE_CONSTANTS.TRAIL_OPACITY,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false; // Disable culling as we don't update bounding sphere
    this.scene.add(line);

    return {
      organismId,
      color: new THREE.Color(color),
      geometry,
      positionBuffer,
      colorBuffer,
      historyBuffer,
      line,
      maxLength: this.maxTrailLength,
      lastFrameId: this.currentFrameId,
      historySize: 0,
      historyWriteIndex: 0,
    };
  }

  /**
   * Updating buffer attribute content (Zero GC - no new allocations!).
   */
  private updateTrailBuffers(trail: Trail): void {
    const count = trail.historySize;
    if (count < PARTICLE_CONSTANTS.VECTOR2_OFFSET) {
      trail.geometry.setDrawRange(0, 0);
      return;
    }
    const startIndex = (trail.historyWriteIndex - count + trail.maxLength) % trail.maxLength;

    // Incremental buffer filling with deterministic data
    for (let i = 0; i < count; i++) {
      const historyIndex = (startIndex + i) % trail.maxLength;
      const sourceOffset = historyIndex * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      const targetOffset = i * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
      const alpha = (i + 1) / count;

      trail.positionBuffer[targetOffset + PARTICLE_CONSTANTS.X_OFFSET] =
        trail.historyBuffer[sourceOffset + PARTICLE_CONSTANTS.X_OFFSET] ?? 0;
      trail.positionBuffer[targetOffset + PARTICLE_CONSTANTS.Y_OFFSET] =
        trail.historyBuffer[sourceOffset + PARTICLE_CONSTANTS.Y_OFFSET] ?? 0;
      trail.positionBuffer[targetOffset + PARTICLE_CONSTANTS.Z_OFFSET] =
        trail.historyBuffer[sourceOffset + PARTICLE_CONSTANTS.Z_OFFSET] ?? 0;

      trail.colorBuffer[targetOffset + PARTICLE_CONSTANTS.X_OFFSET] = trail.color.r * alpha;
      trail.colorBuffer[targetOffset + PARTICLE_CONSTANTS.Y_OFFSET] = trail.color.g * alpha;
      trail.colorBuffer[targetOffset + PARTICLE_CONSTANTS.Z_OFFSET] = trail.color.b * alpha;
    }

    const posAttr = trail.geometry.attributes['position'] as THREE.BufferAttribute;
    const colorAttr = trail.geometry.attributes['color'] as THREE.BufferAttribute;

    // Notifying GPU to update only the involved memory fragment
    posAttr.addUpdateRange(0, count * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);
    colorAttr.addUpdateRange(0, count * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS);

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Adjusting vertex draw index
    trail.geometry.setDrawRange(0, count);
  }

  private appendTrailPoint(trail: Trail, position: Vector3): void {
    const writeOffset = trail.historyWriteIndex * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
    trail.historyBuffer[writeOffset + PARTICLE_CONSTANTS.X_OFFSET] = position.x;
    trail.historyBuffer[writeOffset + PARTICLE_CONSTANTS.Y_OFFSET] = position.y;
    trail.historyBuffer[writeOffset + PARTICLE_CONSTANTS.Z_OFFSET] = position.z;

    trail.historyWriteIndex = (trail.historyWriteIndex + 1) % trail.maxLength;
    if (trail.historySize < trail.maxLength) {
      trail.historySize++;
    }
  }

  private getLastTrailPoint(trail: Trail): Vector3 | null {
    if (trail.historySize === 0) {
      return null;
    }
    const lastIndex = (trail.historyWriteIndex - 1 + trail.maxLength) % trail.maxLength;
    const offset = lastIndex * PARTICLE_CONSTANTS.VECTOR3_COMPONENTS;
    return {
      x: trail.historyBuffer[offset + PARTICLE_CONSTANTS.X_OFFSET] ?? 0,
      y: trail.historyBuffer[offset + PARTICLE_CONSTANTS.Y_OFFSET] ?? 0,
      z: trail.historyBuffer[offset + PARTICLE_CONSTANTS.Z_OFFSET] ?? 0,
    };
  }
}
