/**
 * Opt-in resource stock of the ecological pilot (issue #57, stage J).
 * The values are assumptions the pilot is measured against, not a calibrated model. One unit pays for one food item.
 */

/** Units a zone holds when a stock world starts, and the most it can hold. */
export const RESOURCE_STOCK_CAPACITY_PER_ZONE = 40;

/**
 * Units a zone regains per tick. The five zones regain 0.8 units per tick in total, the same as the baseline food spawn
 * rate (FOOD_SPAWN_RATE). So the pilot limits where food comes from, not how much arrives on average while stocks are full.
 */
export const RESOURCE_STOCK_REGEN_PER_TICK = 0.16;

/** Units one food item costs. */
export const RESOURCE_STOCK_UNITS_PER_FOOD = 1;
