/**
 * CameraDataProvider - кэш данных камеры.
 * Извлечено из Engine.ts для лучшего разделения ответственности.
 */

import type { CameraData } from '@/types';

/**
 * Провайдер данных камеры.
 * Кэширует полные данные камеры для использования в рендеринге и статистике.
 */
export class CameraDataProvider {
  private cameraDataCache: CameraData | null = null;

  /**
   * Установить данные камеры.
   * @param cameraData - Полные данные камеры
   */
  setCameraData(cameraData: CameraData): void {
    this.cameraDataCache = { ...cameraData };
  }

  /**
   * Получить закэшированные данные камеры.
   * @returns Данные камеры или null, если не установлены
   */
  getCameraData(): CameraData | null {
    return this.cameraDataCache;
  }

  /**
   * Очистить кэш данных камеры.
   */
  clear(): void {
    this.cameraDataCache = null;
  }
}
