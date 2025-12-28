/**
 * Entity Manager - Manages all simulation entities (organisms, food, obstacles).
 *
 * Responsibilities:
 * - Store and manage entity collections
 * - Entity lookup by position and instance ID
 * - Entity lifecycle (add/remove)
 *
 * Benefits:
 * - Single Responsibility Principle
 * - Testable in isolation
 * - Clear API for entity management
 */

import { ENGINE_CONSTANTS } from '@/config';

import type { Food, Obstacle, Organism } from '../Entity';
import type { SpatialHashGrid } from '../SpatialHashGrid';

export class EntityManager {
  public readonly organisms: Map<string, Organism> = new Map();
  public readonly food: Map<string, Food> = new Map();
  public readonly obstacles: Map<string, Obstacle> = new Map();

  constructor(private readonly spatialGrid: SpatialHashGrid) {}

  /**
   * Find organism at given position.
   * @param pos - 3D position
   * @param tolerance - Search radius
   * @returns Closest organism or null
   */
  public findEntityAt(
    pos: { x: number; y: number; z: number },
    tolerance: number
  ): Organism | null {
    const candidates = this.getEntityCandidates(pos, tolerance);
    return this.findClosestOrganism(candidates, pos, tolerance);
  }

  /**
   * Find food at given position.
   * @param pos - 3D position
   * @param tolerance - Search radius
   * @returns Closest food or null
   */
  public findFoodAt(
    pos: { x: number; y: number; z: number },
    tolerance: number
  ): Food | null {
    let closest: Food | null = null;
    let minDistSq = tolerance * tolerance;

    for (const foodItem of this.food.values()) {
      if (foodItem.consumed) {
        continue;
      }

      const distSq = this.calculateDistanceSq(foodItem.position, pos);
      const hitRadius = Math.max(
        tolerance,
        foodItem.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_FOOD
      );

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = foodItem;
      }
    }
    return closest;
  }

  /**
   * Get entity by instance ID from render buffer.
   * @param type - Entity type
   * @param index - Instance index
   * @returns Entity or null
   */
  public getEntityByInstanceId(
    type: 'prey' | 'predator' | 'food',
    index: number
  ): Organism | Food | null {
    if (type === 'food') {
      return this.getFoodByInstanceId(index);
    }
    return this.getOrganismByInstanceId(type, index);
  }

  /**
   * Remove dead organisms from collection.
   * @param deadIds - IDs of dead organisms
   * @returns Number of removed organisms
   */
  public removeDeadOrganisms(deadIds: string[]): number {
    let removed = 0;
    for (const id of deadIds) {
      if (this.organisms.delete(id)) {
        removed++;
      }
    }
    return removed;
  }

  /**
   * Remove consumed food from collection.
   * @returns Number of removed food items
   */
  public removeConsumedFood(): number {
    let removed = 0;
    for (const [id, foodItem] of this.food.entries()) {
      if (foodItem.consumed) {
        this.food.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Add organism to collection.
   */
  public addOrganism(organism: Organism): void {
    this.organisms.set(organism.id, organism);
  }

  /**
   * Add food to collection.
   */
  public addFood(foodItem: Food): void {
    this.food.set(foodItem.id, foodItem);
  }

  /**
   * Add obstacle to collection.
   */
  public addObstacle(obstacle: Obstacle): void {
    this.obstacles.set(obstacle.id, obstacle);
  }

  /**
   * Clear all entities.
   */
  public clear(): void {
    this.organisms.clear();
    this.food.clear();
    this.obstacles.clear();
  }

  private getEntityCandidates(
    pos: { x: number; y: number; z: number },
    tolerance: number
  ): string[] {
    try {
      if (this.spatialGrid) {
        const neighbors = this.spatialGrid.getNearby(
          pos,
          tolerance * ENGINE_CONSTANTS.GRID_FALLBACK_MULT
        );
        return neighbors.map((n) => n.id);
      }
    } catch {
      // Fallback to full list search
    }
    return Array.from(this.organisms.keys());
  }

  private findClosestOrganism(
    ids: string[],
    pos: { x: number; y: number; z: number },
    tolerance: number
  ): Organism | null {
    let closest: Organism | null = null;
    let minDistSq = tolerance * tolerance;

    for (const id of ids) {
      const org = this.organisms.get(id);
      if (!org || org.isDead) {
        continue;
      }

      const distSq = this.calculateDistanceSq(org.position, pos);
      const hitRadius = Math.max(
        tolerance,
        org.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_ORG
      );

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = org;
      }
    }

    return closest || this.findClosestOrganismFallback(pos, tolerance);
  }

  private findClosestOrganismFallback(
    pos: { x: number; y: number; z: number },
    tolerance: number
  ): Organism | null {
    let closest: Organism | null = null;
    let minDistSq = tolerance * tolerance;

    for (const org of this.organisms.values()) {
      if (org.isDead) {
        continue;
      }
      const distSq = this.calculateDistanceSq(org.position, pos);
      const hitRadius = Math.max(
        tolerance,
        org.radius * ENGINE_CONSTANTS.HIT_RADIUS_MULT_ORG_FALLBACK
      );

      if (distSq < hitRadius * hitRadius && distSq < minDistSq) {
        minDistSq = distSq;
        closest = org;
      }
    }
    return closest;
  }

  private getFoodByInstanceId(index: number): Food | null {
    let currentIdx = 0;
    for (const foodItem of this.food.values()) {
      if (!foodItem.consumed) {
        if (currentIdx === index) {
          return foodItem;
        }
        currentIdx++;
      }
    }
    return null;
  }

  private getOrganismByInstanceId(
    type: 'prey' | 'predator',
    index: number
  ): Organism | null {
    let currentIdx = 0;
    const isPrey = type === 'prey';

    for (const org of this.organisms.values()) {
      if (org.isDead) {
        continue;
      }
      if (org.isPrey === isPrey) {
        if (currentIdx === index) {
          return org;
        }
        currentIdx++;
      }
    }
    return null;
  }

  private calculateDistanceSq(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number }
  ): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
  }
}
