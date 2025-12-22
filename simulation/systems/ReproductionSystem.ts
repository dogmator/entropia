/**
 * Entropia 3D — Система Розмноження
 *
 * Відповідальність: Обробка репродукції організмів
 * - Перевірка готовності до розмноження
 * - Витрата енергії на репродукцію
 * - Створення нащадків з мутаціями
 * - Ведення генетичного дерева
 */

import { Organism, OrganismFactory } from '../Entity';
import { SimulationConfig, GenomeId, GeneticTreeNode, EntityType, OrganismId } from '../../types';
import { MIN_REPRODUCTION_AGE } from '../../constants';
import { EventBus } from '../../core/EventBus';

/**
 * Константи розмноження
 */
const ENERGY_COST_MULTIPLIER = 0.45; // Скільки енергії залишається після розмноження
const MIN_AGE = MIN_REPRODUCTION_AGE; // Мінімальний вік для розмноження

/**
 * Дані про новонародженого
 */
export interface NewbornData {
  parent: Organism;
}

export class ReproductionSystem {
  constructor(
    private readonly config: SimulationConfig,
    private readonly organismFactory: OrganismFactory,
    private readonly eventBus: EventBus,
    private readonly geneticTree: Map<GenomeId, GeneticTreeNode>,
    private readonly geneticRoots: GenomeId[],
    private currentTick: number = 0
  ) { }

  /**
   * Встановити поточний тік
   */
  setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Перевірити можливість розмноження і зібрати кандидатів
   */
  checkReproduction(organisms: Map<string, Organism>, maxPopulation: number): NewbornData[] {
    const newborns: NewbornData[] = [];
    const currentPopulation = organisms.size;

    organisms.forEach(organism => {
      // Перевірка з урахуванням поточної популяції + вже зібрані новонароджені
      if (this.canReproduce(organism, currentPopulation + newborns.length, maxPopulation)) {
        this.initiateReproduction(organism, newborns);
      }
    });

    return newborns;
  }

  /**
   * Перевірити чи може організм розмножуватись
   */
  private canReproduce(organism: Organism, currentPopulation: number, maxPopulation: number): boolean {
    if (organism.isDead) return false;
    if (organism.energy < this.config.reproductionThreshold) return false;
    if (organism.age < MIN_AGE) return false;
    if (currentPopulation >= maxPopulation) return false; // Перевірка ліміту популяції

    return true;
  }

  /**
   * Розпочати процес розмноження
   */
  private initiateReproduction(organism: Organism, newborns: NewbornData[]): void {
    // Витратити енергію на розмноження
    organism.energy *= ENERGY_COST_MULTIPLIER;

    // Змінити стан організму
    organism.updateState('REPRODUCING');

    // Додати до списку новонароджених
    newborns.push({ parent: organism });
  }

  /**
   * Створити нащадків
   */
  createOffspring(
    newborns: NewbornData[],
    organisms: Map<string, Organism>,
    maxPopulation: number,
    stats: { totalBirths: number }
  ): void {
    for (const data of newborns) {
      // Перевірити ліміт популяції
      if (organisms.size >= maxPopulation) break;

      const child = this.organismFactory.createOffspring(data.parent);
      organisms.set(child.id, child);

      // Додати до генетичного дерева
      this.addToGeneticTree(child, data.parent);

      // Оновити статистику
      stats.totalBirths++;

      // Відправити подію
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
   * Додати організм до генетичного дерева
   */
  private addToGeneticTree(organism: Organism, parent?: Organism): void {
    const node: GeneticTreeNode = {
      id: organism.genome.id,
      parentId: parent?.genome.id || null,
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
        (parentNode.children as GenomeId[]).push(organism.genome.id);
      }
    } else {
      this.geneticRoots.push(organism.genome.id);
    }
  }

  /**
   * Оновити генетичне дерево після смерті
   */
  updateGeneticTreeOnDeath(organism: Organism): void {
    const node = this.geneticTree.get(organism.genome.id);
    if (node) {
      // TypeScript workaround для мутації readonly поля
      (node as { died: number | null }).died = this.currentTick;
    }
  }

  /**
   * Отримати інформацію про генетичне дерево
   */
  getGeneticTreeInfo() {
    return {
      nodes: this.geneticTree,
      roots: this.geneticRoots,
      size: this.geneticTree.size,
    };
  }

  /**
   * Отримати нащадків організму
   */
  getDescendants(genomeId: GenomeId): GenomeId[] {
    const node = this.geneticTree.get(genomeId);
    if (!node) return [];

    const descendants: GenomeId[] = [];
    const queue: GenomeId[] = [...(node.children as GenomeId[])];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      descendants.push(currentId);

      const currentNode = this.geneticTree.get(currentId);
      if (currentNode && currentNode.children.length > 0) {
        queue.push(...(currentNode.children as GenomeId[]));
      }
    }

    return descendants;
  }

  /**
   * Отримати предків організму
   */
  getAncestors(genomeId: GenomeId): GenomeId[] {
    const ancestors: GenomeId[] = [];
    let currentId: GenomeId | null = genomeId;

    while (currentId) {
      const node = this.geneticTree.get(currentId);
      if (!node || !node.parentId) break;

      ancestors.push(node.parentId);
      currentId = node.parentId;
    }

    return ancestors;
  }

  /**
   * Розрахувати середню фертильність популяції
   */
  calculateFertilityRate(organisms: Map<string, Organism>, maxPopulation: number): number {
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
