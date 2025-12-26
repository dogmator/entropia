/**
 * Entropia 3D — Branded Types для типобезпечних ідентифікаторів.
 *
 * Патерн «Branded Type» запобігає семантичному змішуванню ідентифікаторів
 * різних доменів на етапі компіляції TypeScript.
 *
 * @module shared/types/brands
 */

declare const __brand: unique symbol;

/**
 * Універсальний генеричний тип для створення брендованих типів.
 *
 * @example
 * const orgId: OrganismId = "123" as OrganismId;
 * const foodId: FoodId = "123" as FoodId;
 * // Операція (orgId === foodId) ініціює помилку компіляції!
 */
export type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

// ============================================================================
// БРЕНДОВАНІ ІДЕНТИФІКАТОРИ СУТНОСТЕЙ
// ============================================================================

/** Унікальний ідентифікатор організму (травоїдного або хижака). */
export type OrganismId = Brand<string, 'OrganismId'>;

/** Унікальний ідентифікатор енергетичного ресурсу (їжі). */
export type FoodId = Brand<string, 'FoodId'>;

/** Унікальний ідентифікатор просторової перешкоди. */
export type ObstacleId = Brand<string, 'ObstacleId'>;

/** Унікальний ідентифікатор генетичного коду. */
export type GenomeId = Brand<string, 'GenomeId'>;

/** Об'єднаний тип для всіх можливих ідентифікаторів сутностей. */
export type EntityId = OrganismId | FoodId | ObstacleId;

// ============================================================================
// ФАБРИЧНІ ФУНКЦІЇ СТВОРЕННЯ ІДЕНТИФІКАТОРІВ
// ============================================================================

/**
 * Створює типобезпечний ідентифікатор організму.
 */
export const createOrganismId = (id: string): OrganismId => id as OrganismId;

/**
 * Створює типобезпечний ідентифікатор їжі.
 */
export const createFoodId = (id: string): FoodId => id as FoodId;

/**
 * Створює типобезпечний ідентифікатор перешкоди.
 */
export const createObstacleId = (id: string): ObstacleId => id as ObstacleId;

/**
 * Створює типобезпечний ідентифікатор геному.
 */
export const createGenomeId = (id: string): GenomeId => id as GenomeId;
