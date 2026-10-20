import { RENDER } from '@/config';

/** Radius of the shared food icosahedron, before per-instance scaling. */
export const FOOD_GEOMETRY_RADIUS = RENDER.geometry.food.radius;

/**
 * Per-instance scale of a food mesh. It follows the model radius from the render buffer
 * and the user's resource scale. The shared geometry is then scaled by this value.
 */
export const foodInstanceScale = (modelRadius: number, resourceScale: number): number =>
  modelRadius * resourceScale;

/**
 * Radius of the sphere that actually bounds a rendered food instance.
 * Frustum culling must use this value, not the instance scale, or visible food near the screen edge is dropped.
 */
export const foodBoundingRadius = (instanceScale: number): number =>
  FOOD_GEOMETRY_RADIUS * instanceScale;
