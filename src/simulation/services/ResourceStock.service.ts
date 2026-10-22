import {
  RESOURCE_STOCK_CAPACITY_PER_ZONE,
  RESOURCE_STOCK_REGEN_PER_TICK,
  RESOURCE_STOCK_UNITS_PER_FOOD,
} from '@/config';
import type { EcologicalZone, Vector3 } from '@/types';

interface ZoneCentre {
  readonly id: string;
  readonly center: Vector3;
}

export interface ResourceStockSetup {
  /** Whether food is paid from the zone stocks. The baseline keeps the stock off. */
  readonly enabled: boolean;
  /** Stock per zone id, as a snapshot records it. Missing zones start full. */
  readonly stocks: Readonly<Record<string, number>> | undefined;
}

/**
 * Opt-in finite resource per ecological zone (issue #57, stage J).
 *
 * While enabled, food can appear only when the zone that owns its position can pay for it, so the zone stocks are the
 * only source of food. Each zone regains a fixed amount per tick, never above its capacity. Food is placed outside all
 * zones (see SpawnService), so a zone owns the food spawned nearest to its centre.
 *
 * While disabled the stock does nothing, and the engine behaves as it did before this pilot.
 */
export class ResourceStock {
  private enabled = false;
  private centres: ZoneCentre[] = [];
  private readonly stocks = new Map<string, number>();

  /** Units added by regeneration since the world was created or restored. Measurement only. */
  public unitsRegenerated = 0;
  /** Units paid for food since the world was created or restored. Measurement only. */
  public unitsSpent = 0;
  /** Food attempts refused for lack of stock since the world was created or restored. Measurement only. */
  public attemptsRefused = 0;

  public get isEnabled(): boolean {
    return this.enabled;
  }

  /** Starts a world's stock from its zones. Counters restart, because the ledger covers one world at a time. */
  public reset(zones: Iterable<EcologicalZone>, setup: ResourceStockSetup): void {
    this.enabled = setup.enabled;
    this.centres = Array.from(zones, zone => ({ id: zone.id, center: { ...zone.center } }));
    this.stocks.clear();
    for (const { id } of this.centres) {
      this.stocks.set(id, setup.stocks?.[id] ?? RESOURCE_STOCK_CAPACITY_PER_ZONE);
    }
    this.unitsRegenerated = 0;
    this.unitsSpent = 0;
    this.attemptsRefused = 0;
  }

  /** The zone whose centre is nearest to a position. A tie goes to the zone listed first. */
  public zoneAt(position: Vector3): string | undefined {
    let nearest: string | undefined;
    let nearestDistance = Infinity;
    for (const { id, center } of this.centres) {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      const dz = position.z - center.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance) {
        nearest = id;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  public stockOf(zoneId: string): number {
    return this.stocks.get(zoneId) ?? 0;
  }

  /** Adds one tick of regeneration to every zone. A zone never ends above its capacity. */
  public regenerate(): void {
    if (!this.enabled) return;
    for (const [id, stock] of this.stocks) {
      const next = Math.min(RESOURCE_STOCK_CAPACITY_PER_ZONE, stock + RESOURCE_STOCK_REGEN_PER_TICK);
      this.stocks.set(id, next);
      this.unitsRegenerated += next - stock;
    }
  }

  /**
   * Pays for one food item at a position. Returns false and pays nothing when the owning zone cannot afford it.
   * While the stock is off every item is admitted, so the caller needs no branch of its own.
   */
  public admitFoodAt(position: Vector3): boolean {
    if (!this.enabled) return true;
    const zoneId = this.zoneAt(position);
    const stock = zoneId === undefined ? 0 : this.stockOf(zoneId);
    if (zoneId === undefined || stock < RESOURCE_STOCK_UNITS_PER_FOOD) {
      this.attemptsRefused++;
      return false;
    }
    this.stocks.set(zoneId, stock - RESOURCE_STOCK_UNITS_PER_FOOD);
    this.unitsSpent += RESOURCE_STOCK_UNITS_PER_FOOD;
    return true;
  }

  /** Stock per zone id, in zone order. Used by the snapshot. */
  public toRecord(): Record<string, number> {
    return Object.fromEntries(this.stocks);
  }
}
