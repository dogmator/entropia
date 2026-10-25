/**
 * Entity ids have the form `<prefix>_<number>`. The render buffers carry only the number, so a hover resolves an
 * entity by it. Ids are created and rebuilt through the functions below, so the two directions cannot drift apart.
 */

const ORGANISM_PREFIX = 'org';
const FOOD_PREFIX = 'food';

/** The number that follows the prefix of an entity id, as the render buffers store it. */
export const numericIdOf = (id: string): number => parseInt(id.split('_')[1] ?? '0', 10);

export const organismIdOf = (numericId: number): string => `${ORGANISM_PREFIX}_${String(numericId)}`;

export const foodIdOf = (numericId: number): string => `${FOOD_PREFIX}_${String(numericId)}`;
