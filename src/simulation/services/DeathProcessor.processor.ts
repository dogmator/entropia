import { MAX_DEAD_BODIES } from '@/config/population.constants';
import type { EventBus } from '@/core';
import { logger } from '@/core';
import type { EntityId } from '@/types';

import type { Organism } from '../Entity';
import type { EntityManager } from '../managers/EntityManager.manager';
import type { ReproductionSystem } from '../systems/Reproduction.system';
import type { StatisticsManager } from './StatisticsManager.manager';

export interface DeathProcessorDeps {
    entityManager: EntityManager;
    deadOrganisms: Map<string, Organism>;
    eventBus: EventBus;
    reproductionSystem: ReproductionSystem;
    statisticsManager: StatisticsManager;
}

export class DeathProcessor {
    private readonly entityManager: EntityManager;
    private readonly deadOrganisms: Map<string, Organism>;
    private readonly eventBus: EventBus;
    private readonly reproductionSystem: ReproductionSystem;
    private readonly statisticsManager: StatisticsManager;

    constructor({ entityManager, deadOrganisms, eventBus, reproductionSystem, statisticsManager }: DeathProcessorDeps) {
        this.entityManager = entityManager;
        this.deadOrganisms = deadOrganisms;
        this.eventBus = eventBus;
        this.reproductionSystem = reproductionSystem;
        this.statisticsManager = statisticsManager;
    }

    public process(deadIds: string[]): void {
        let newDeaths = 0;

        for (const id of deadIds) {
            const org = this.entityManager.organisms.get(id);
            if (!org) continue;

            newDeaths++;
            this.reproductionSystem.updateGeneticTreeOnDeath(org);
            this.entityManager.organisms.delete(id);

            this.deadOrganisms.set(id, org);
            if (this.deadOrganisms.size > MAX_DEAD_BODIES) {
                const oldestId = this.deadOrganisms.keys().next().value;
                if (oldestId) {
                    this.deadOrganisms.delete(oldestId);
                }
            }

            this.eventBus.emit({
                type: 'EntityDied',
                entityType: org.type,
                id: id as EntityId,
                position: org.position,
                causeOfDeath: org.causeOfDeath ?? 'old_age',
            });
        }

        if (newDeaths > 0) {
            this.statisticsManager.incrementDeaths(newDeaths);
            logger.debug(`Engine: ${String(newDeaths)} organisms died. Total dead in memory: ${String(this.deadOrganisms.size)}`, 'Engine');
        }
    }
}
