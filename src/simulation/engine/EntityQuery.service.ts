import type { RenderedKind } from '@shared/interfaces/RenderedKind';
import type { Food, Organism } from '@simulation/Entity';
import type { EntityManager } from '@simulation/managers/EntityManager.manager';
import { foodIdOf, organismIdOf } from '@simulation/utils/EntityIds';

import type { EcologicalZone, GeneticTreeNode, GenomeId } from '@/types';

export interface QueryCtx {
    readonly entityManager: EntityManager;
    readonly deadOrganisms: Map<string, Organism>;
    readonly zones: Map<string, EcologicalZone>;
    readonly geneticTree: Map<GenomeId, GeneticTreeNode>;
    readonly geneticRoots: GenomeId[];
}

export class EntityQuery {
    constructor(private readonly ctx: QueryCtx) {}

    public findEntityAt(pos: { x: number; y: number; z: number }, tolerance: number): Promise<Organism | null> {
        return Promise.resolve(this.ctx.entityManager.findEntityAt(pos, tolerance));
    }

    public findFoodAt(pos: { x: number; y: number; z: number }, tolerance: number): Food | null {
        return this.ctx.entityManager.findFoodAt(pos, tolerance);
    }

    /**
     * Resolves the entity that a render buffer entry carries. The lookup goes by id, so the answer does not depend on where
     * the entry sat in a buffer, which is rebuilt at every snapshot and filtered by the camera.
     */
    public getEntityByNumericId(kind: RenderedKind, numericId: number, isDead: boolean): Promise<Organism | Food | null> {
        return Promise.resolve(this.findByNumericId(kind, numericId, isDead));
    }

    public getZones(): Map<string, EcologicalZone> { return this.ctx.zones; }

    public getGeneticNode(genomeId: GenomeId): Promise<unknown> {
        return Promise.resolve(this.ctx.geneticTree.get(genomeId));
    }

    public getGeneticRoots(): Promise<GenomeId[]> {
        return Promise.resolve(this.ctx.geneticRoots);
    }

    private findByNumericId(kind: RenderedKind, numericId: number, isDead: boolean): Organism | Food | null {
        if (kind === 'food') {
            const food = this.ctx.entityManager.food.get(foodIdOf(numericId));
            return food && !food.consumed ? food : null;
        }
        const id = organismIdOf(numericId);
        const organism = isDead ? this.ctx.deadOrganisms.get(id) : this.ctx.entityManager.organisms.get(id);
        return organism?.isPrey === (kind === 'prey') ? organism : null;
    }
}
