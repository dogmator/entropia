/**
 * Entropia 3D — Reproductive process modeling system (Reproduction System).
 *
 * Responsible for biological agent replication and maintaining genetic inheritance:
 * - Verifying physiological readiness of organisms for reproduction (age, energy balance).
 * - Calculating energy costs for the act of reproduction.
 * - Creating new instances with genome transmission and modification (mutagenesis).
 * - Forming and updating the population's phylogenetic tree.
 */

import { MIN_REPRODUCTION_AGE, REPRODUCTION } from '@/config';
import type { EventBus } from '@/core';
import type { GeneticTreeNode, GenomeId, OrganismId, SimulationConfig } from '@/types';

import type { Organism, OrganismFactory } from '../Entity';

/**
 * Reproductive cycle parameter constants.
 */
const MIN_AGE = MIN_REPRODUCTION_AGE; // Reproductive maturity threshold (minimum age).

/**
 * Data container for new organism initialization.
 */
export interface NewbornData {
  parent: Organism;
  energy: number;
}

/**
 * Class implementing population dynamics and genetic inheritance.
 */
export interface ReproductionSystemDeps {
  config: SimulationConfig;
  organismFactory: OrganismFactory;
  eventBus: EventBus;
  geneticTree: Map<GenomeId, GeneticTreeNode>;
  geneticRoots: GenomeId[];
  initialTick?: number;
}

export class ReproductionSystem {
  private readonly config: SimulationConfig;
  private readonly organismFactory: OrganismFactory;
  private readonly eventBus: EventBus;
  private readonly geneticTree: Map<GenomeId, GeneticTreeNode>;
  private readonly geneticRoots: GenomeId[];
  private currentTick: number;

  constructor({
    config,
    organismFactory,
    eventBus,
    geneticTree,
    geneticRoots,
    initialTick = 0,
  }: ReproductionSystemDeps) {
    this.config = config;
    this.organismFactory = organismFactory;
    this.eventBus = eventBus;
    this.geneticTree = geneticTree;
    this.geneticRoots = geneticRoots;
    this.currentTick = initialTick;
  }

  /**
   * Updating the system's internal time counter.
   */
  public setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Screening the population for reproductive readiness.
   */
  public checkReproduction(organisms: Map<string, Organism>, maxPopulation: number): NewbornData[] {
    const newborns: NewbornData[] = [];
    const currentPopulation = organisms.size;

    organisms.forEach(organism => {
      // Verifying reproduction conditions considering environment capacity (maxPopulation)
      if (this.canReproduce(organism, currentPopulation + newborns.length, maxPopulation)) {
        this.initiateReproduction(organism, newborns);
      }
    });

    return newborns;
  }

  /**
   * Comprehensive check of agent's reproductive potential.
   */
  private canReproduce(organism: Organism, currentPopulation: number, maxPopulation: number): boolean {
    if (organism.isDead) { return false; }
    if (organism.energy < this.config.reproductionThreshold) { return false; }
    if (organism.age < MIN_AGE) { return false; }
    if (currentPopulation >= maxPopulation) { return false; } // Environment capacity limit

    return true;
  }

  /**
   * Registering reproduction act and preparing for energy allocation.
   */
  private initiateReproduction(organism: Organism, newborns: NewbornData[]): void {
    // Exothermic energy cost for creating offspring
    organism.energy *= REPRODUCTION.energyCostMultiplier;

    // Transition agent to transient state of reproductive activity
    organism.updateState('REPRODUCING');

    // Aggregating data for subsequent object generation
    newborns.push({
      parent: organism,
      energy: organism.energy
    });
  }

  /**
   * Physical generation of offspring and their integration into population structure.
   */
  // eslint-disable-next-line max-params
  public createOffspring(
    newborns: NewbornData[],
    organisms: Map<string, Organism>,
    maxPopulation: number,
    stats: { totalBirths: number }
  ): void {
    for (const data of newborns) {
      // Population overflow control during creation stage
      if (organisms.size >= maxPopulation) { break; }

      const child = this.organismFactory.createOffspring(data.parent, data.energy);
      organisms.set(child.id, child);

      // Registering links in phylogenetic structure
      this.addToGeneticTree(child, data.parent);

      // Updating global statistical metrics
      stats.totalBirths++;

      // Generating system event about entity birth
      this.eventBus.emit({
        type: 'EntityReproduced',
        parentId: data.parent.id as OrganismId,
        childId: child.id as OrganismId,
        position: { ...child.position },
        generation: child.genome.generation,
      });
    }
  }

  /**
   * Registering a new node in the phylogenetic tree.
   */
  public addToGeneticTree(organism: Organism, parent?: Organism): void {
    const node: GeneticTreeNode = {
      id: organism.genome.id,
      parentId: parent?.genome.id ?? null,
      children: [],
      generation: organism.genome.generation,
      born: this.currentTick,
      died: null,
      type: organism.type,
      traits: {
        speed: organism.genome.maxSpeed,
        sense: organism.genome.senseRadius,
        size: organism.genome.size,
      },
    };

    this.geneticTree.set(organism.genome.id, node);

    if (parent) {
      const parentNode = this.geneticTree.get(parent.genome.id);
      if (parentNode) {
        parentNode.children.push(organism.genome.id);
      }
    } else {
      this.geneticRoots.push(organism.genome.id);
    }
  }

  /**
   * Fixing the moment of genotype elimination (organism death) in the genetic tree.
   */
  public updateGeneticTreeOnDeath(organism: Organism): void {
    const node = this.geneticTree.get(organism.genome.id);
    if (node) {
      node.died = this.currentTick;
    }
  }

  /**
   * Access to full genetic tree structure.
   */
  public getGeneticTreeInfo(): { nodes: Map<GenomeId, GeneticTreeNode>; roots: GenomeId[]; size: number } {
    return {
      nodes: this.geneticTree,
      roots: this.geneticRoots,
      size: this.geneticTree.size,
    };
  }

  /**
   * Recursive retrieval of all descendants of a given genotype.
   */
  public getDescendants(genomeId: GenomeId): GenomeId[] {
    const node = this.geneticTree.get(genomeId);
    if (!node) { return []; }

    const descendants: GenomeId[] = [];
    const queue: GenomeId[] = [...node.children];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) { break; }
      descendants.push(currentId);

      const currentNode = this.geneticTree.get(currentId);
      if (currentNode && currentNode.children.length > 0) {
        queue.push(...currentNode.children);
      }
    }

    return descendants;
  }

  /**
   * Tracking the ancestral phylogenetic line.
   */
  public getAncestors(genomeId: GenomeId): GenomeId[] {
    const ancestors: GenomeId[] = [];
    let currentId: GenomeId | null = genomeId;

    while (currentId) {
      const node = this.geneticTree.get(currentId);
      if (!node?.parentId) { break; }

      ancestors.push(node.parentId);
      currentId = node.parentId;
    }

    return ancestors;
  }

  /**
   * Calculating integral population reproductive readiness indicator (Fertility Rate).
   */
  public calculateFertilityRate(organisms: Map<string, Organism>, maxPopulation: number): number {
    let readyToReproduce = 0;
    let total = 0;
    const currentPopulation = organisms.size;

    organisms.forEach(organism => {
      if (!organism.isDead) {
        total++;
        if (this.canReproduce(organism, currentPopulation, maxPopulation)) {
          readyToReproduce++;
        }
      }
    });

    return total > 0 ? readyToReproduce / total : 0;
  }
}
