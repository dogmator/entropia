/**
 * Generic repository interface for entity storage.
 * Provides abstraction over Map<string, T> for better testability and flexibility.
 *
 * Benefits:
 * - Easy to swap storage implementation (Map, Array, Database)
 * - Mockable for tests
 * - Type-safe entity access
 * - Clear CRUD operations
 */

/**
 * Generic entity repository interface.
 */
export interface IEntityRepository<T> {
  /**
   * Get entity by ID.
   * @param id - Entity identifier
   * @returns Entity or undefined
   */
  get(id: string): T | undefined;

  /**
   * Add entity to repository.
   * @param id - Entity identifier
   * @param entity - Entity to add
   */
  set(id: string, entity: T): void;

  /**
   * Remove entity by ID.
   * @param id - Entity identifier
   * @returns True if removed, false if not found
   */
  delete(id: string): boolean;

  /**
   * Check if entity exists.
   * @param id - Entity identifier
   * @returns True if exists
   */
  has(id: string): boolean;

  /**
   * Get all entities.
   * @returns Iterator over all entities
   */
  values(): IterableIterator<T>;

  /**
   * Get all entity IDs.
   * @returns Iterator over all IDs
   */
  keys(): IterableIterator<string>;

  /**
   * Get all entries (ID + entity pairs).
   * @returns Iterator over entries
   */
  entries(): IterableIterator<[string, T]>;

  /**
   * Iterate over all entities.
   * @param callback - Function to call for each entity
   */
  forEach(callback: (entity: T, id: string) => void): void;

  /**
   * Get repository size.
   * @returns Number of entities
   */
  readonly size: number;

  /**
   * Clear all entities.
   */
  clear(): void;
}

/**
 * Map-based implementation of IEntityRepository.
 */
export class MapEntityRepository<T> implements IEntityRepository<T> {
  private readonly map: Map<string, T> = new Map();

  public get(id: string): T | undefined {
    return this.map.get(id);
  }

  public set(id: string, entity: T): void {
    this.map.set(id, entity);
  }

  public delete(id: string): boolean {
    return this.map.delete(id);
  }

  public has(id: string): boolean {
    return this.map.has(id);
  }

  public values(): IterableIterator<T> {
    return this.map.values();
  }

  public keys(): IterableIterator<string> {
    return this.map.keys();
  }

  public entries(): IterableIterator<[string, T]> {
    return this.map.entries();
  }

  public forEach(callback: (entity: T, id: string) => void): void {
    this.map.forEach(callback);
  }

  public get size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }
}
