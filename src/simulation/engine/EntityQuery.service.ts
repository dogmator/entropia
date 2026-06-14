import type { Food, Organism } from '@simulation/Entity';
import type { EntityManager } from '@simulation/managers/EntityManager.manager';

import type { EcologicalZone, GeneticTreeNode,GenomeId } from '@/types';

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

    public getEntityByInstanceId(type: 'prey' | 'predator' | 'food', index: number, isDead = false): Promise<Organism | Food | null> {
        if (isDead && type !== 'food') return this.findDeadByInstanceId(type, index);
        return Promise.resolve(this.ctx.entityManager.getEntityByInstanceId(type, index));
    }

    public getZones(): Map<string, EcologicalZone> { return this.ctx.zones; }

    public getGeneticNode(genomeId: GenomeId): Promise<unknown> {
        return Promise.resolve(this.ctx.geneticTree.get(genomeId));
    }

    public getGeneticRoots(): Promise<GenomeId[]> {
        return Promise.resolve(this.ctx.geneticRoots);
    }

    private findDeadByInstanceId(type: 'prey' | 'predator', index: number): Promise<Organism | null> {
        const isPrey = type === 'prey';
        let idx = 0;
        for (const org of this.ctx.deadOrganisms.values()) {
            if (org.isPrey === isPrey) {
                if (idx === index) return Promise.resolve(org);
                idx++;
            }
        }
        return Promise.resolve(null);
    }
}
