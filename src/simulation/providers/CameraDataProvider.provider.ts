/**
 * CameraDataProvider - camera data cache.
 * Extracted from Engine.ts for better separation of responsibilities.
 */

import type { CameraData } from '@/types';

/**
 * Camera data provider.
 * Caches full camera data for use in rendering and statistics.
 */
export class CameraDataProvider {
  private cameraDataCache: CameraData | null = null;

  /**
   * Set camera data.
   * @param cameraData - Full camera data
   */
  public setCameraData(cameraData: CameraData): void {
    this.cameraDataCache = { ...cameraData };
  }

  /**
   * Get cached camera data.
   * @returns Camera data or null if not set
   */
  public getCameraData(): CameraData | null {
    return this.cameraDataCache;
  }

  /**
   * Clear camera data cache.
   */
  public clear(): void {
    this.cameraDataCache = null;
  }
}
