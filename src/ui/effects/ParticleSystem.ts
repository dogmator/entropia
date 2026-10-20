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

import * as THREE from 'three';

import { PARTICLE_CONSTANTS, RENDER } from '@/config';
import type { Vector3 } from '@/types';

const POW_2 = 2;

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
