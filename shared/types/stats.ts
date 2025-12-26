/**
 * Entropia 3D — Типи статистики та метрик.
 *
 * Визначає структури для збору та відображення
 * статистичних даних симуляції.
 *
 * @module shared/types/stats
 */

// ============================================================================
// МЕТРИКИ ПРОДУКТИВНОСТІ
// ============================================================================

/**
 * Показники продуктивності рендерингу та симуляції.
 */
export interface PerformanceMetrics {
  /** Частота оновлення кадрів (FPS). */
  readonly fps: number;
  /** Частота оновлення симуляції (TPS). */
  readonly tps: number;
  /** Час рендерингу кадру (мс). */
  readonly frameTime: number;
  /** Час обчислення симуляції (мс). */
  readonly simulationTime: number;
  /** Загальна кількість сутностей. */
  readonly entityCount: number;
  /** Кількість draw calls. */
  readonly drawCalls: number;
}

// ============================================================================
// СТАТИСТИКА СИМУЛЯЦІЇ
// ============================================================================

/**
 * Комплексні статистичні показники біосфери.
 */
export interface SimulationStats {
  /** Кількість травоїдних. */
  readonly preyCount: number;
  /** Кількість хижаків. */
  readonly predatorCount: number;
  /** Кількість одиниць їжі. */
  readonly foodCount: number;
  /** Середня енергія всіх організмів. */
  readonly avgEnergy: number;
  /** Середня енергія травоїдних. */
  readonly avgPreyEnergy: number;
  /** Середня енергія хижаків. */
  readonly avgPredatorEnergy: number;
  /** Поточний такт симуляції. */
  readonly generation: number;
  /** Максимальне покоління в популяції. */
  readonly maxGeneration: number;
  /** Максимальний вік організму. */
  readonly maxAge: number;
  /** Загальна кількість смертей. */
  readonly totalDeaths: number;
  /** Загальна кількість народжень. */
  readonly totalBirths: number;
  /** Ризик вимирання (0-1). */
  readonly extinctionRisk: number;
  /** Метрики продуктивності (опціонально). */
  readonly performance?: PerformanceMetrics;

  // Геометричні дані світу (для діагностики)
  readonly worldSize?: number;
  readonly cameraX?: number;
  readonly cameraY?: number;
  readonly cameraZ?: number;
  readonly targetX?: number;
  readonly targetY?: number;
  readonly targetZ?: number;
  readonly zoom?: number;
  readonly cameraDistance?: number;
  readonly cameraFov?: number;
  readonly cameraAspect?: number;
  readonly growthZones?: number;
  readonly neutralZones?: number;
  readonly dangerZones?: number;
  readonly totalZones?: number;
  readonly cellSize?: number;
  readonly totalCells?: number;
  readonly occupiedCells?: number;
  readonly avgDensity?: number;
  readonly maxDensity?: number;
  readonly gridEfficiency?: number;
  readonly foodSpawnRate?: number;
  readonly obstacleCount?: number;
  readonly worldAge?: number;
  readonly activeZones?: number;
}

// ============================================================================
// ІСТОРІЯ ПОПУЛЯЦІЇ
// ============================================================================

/**
 * Знімок популяції в конкретний момент часу.
 */
export interface PopulationSnapshot {
  readonly tick: number;
  readonly prey: number;
  readonly predators: number;
  readonly food: number;
  readonly avgEnergy: number;
}

/**
 * Точка даних для графіків популяції.
 */
export interface PopulationDataPoint {
  readonly time: number;
  readonly prey: number;
  readonly pred: number;
  readonly food?: number;
}
