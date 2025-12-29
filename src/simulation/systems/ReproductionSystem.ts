/**
 * Entropia 3D — Система моделювання репродуктивних процесів (Reproduction System).
 *
 * Відповідає за реплікацію біологічних агентів та підтримку генетичної спадковості:
 * - Верифікація фізіологічної готовності організмів до розмноження (вік, енергобаланс).
 * - Розрахунок енергетичних витрат на акт репродукції.
 * - Створення нових екземплярів із передачею та модифікацією геному (мутагенез).
 * - Формування та актуалізація філогенетичного дерева популяції.
 */

import { MIN_REPRODUCTION_AGE, REPRODUCTION } from '@/config';
import type { EventBus } from '@/core';
import type { GeneticTreeNode, GenomeId, OrganismId, SimulationConfig } from '@/types';

import type { Organism, OrganismFactory } from '../Entity';

/**
 * Константи параметрів репродуктивного циклу.
 */
const MIN_AGE = MIN_REPRODUCTION_AGE; // Поріг репродуктивної зрілості (мінімальний вік).

/**
 * Контейнер даних для ініціалізації нового організму.
 */
export interface NewbornData {
  parent: Organism;
  energy: number;
}

/**
 * Клас, що реалізує популяційну динаміку та генетичну спадковість.
 */
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
   * Оновлення внутрішнього часового лічильника системи.
   */
  setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Скринінг популяції на предмет готовності до розмноження.
   */
  checkReproduction(organisms: Map<string, Organism>, maxPopulation: number): NewbornData[] {
    const newborns: NewbornData[] = [];
    const currentPopulation = organisms.size;

    organisms.forEach(organism => {
      // Верифікація умов репродукції з урахуванням ємності середовища (maxPopulation)
      if (this.canReproduce(organism, currentPopulation + newborns.length, maxPopulation)) {
        this.initiateReproduction(organism, newborns);
      }
    });

    return newborns;
  }

  /**
   * Комплексна перевірка репродуктивного потенціалу агента.
   */
  private canReproduce(organism: Organism, currentPopulation: number, maxPopulation: number): boolean {
    if (organism.isDead) { return false; }
    if (organism.energy < this.config.reproductionThreshold) { return false; }
    if (organism.age < MIN_AGE) { return false; }
    if (currentPopulation >= maxPopulation) { return false; } // Обмеження ємності екосистеми

    return true;
  }

  /**
   * Реєстрація акту репродукції та підготовка до виділення енергії.
   */
  private initiateReproduction(organism: Organism, newborns: NewbornData[]): void {
    // Екзотермічна витрата енергії на створення нащадка
    organism.energy *= REPRODUCTION.energyCostMultiplier;

    // Переведення агента у транзитний стан репродуктивної активності
    organism.updateState('REPRODUCING');

    // Агрегування даних для подальшої генерації об'єкта
    newborns.push({
      parent: organism,
      energy: organism.energy
    });
  }

  /**
   * Фізична генерація нащадків та інтеграція їх у популяційну структуру.
   */
  createOffspring(
    newborns: NewbornData[],
    organisms: Map<string, Organism>,
    maxPopulation: number,
    stats: { totalBirths: number }
  ): void {
    for (const data of newborns) {
      // Контроль переповнення популяції на етапі створення
      if (organisms.size >= maxPopulation) { break; }

      const child = this.organismFactory.createOffspring(data.parent, data.energy);
      organisms.set(child.id, child);

      // Реєстрація зв'язків у філогенетичній структурі
      this.addToGeneticTree(child, data.parent);

      // Актуалізація глобальних статистичних метрик
      stats.totalBirths++;

      // Генерація системної події про народження сутності
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
   * Реєстрація нового вузла у філогенетичному дереві.
   */
  public addToGeneticTree(organism: Organism, parent?: Organism): void {
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
   * Фіксація моменту елімінації генотипу (смерті організму) у генетичному дереві.
   */
  updateGeneticTreeOnDeath(organism: Organism): void {
    const node = this.geneticTree.get(organism.genome.id);
    if (node) {
      // Корекція readonly поля через приведення типів для фіксації термінації
      (node as { died: number | null }).died = this.currentTick;
    }
  }

  /**
   * Доступ до повної структури генетичного дерева.
   */
  getGeneticTreeInfo() {
    return {
      nodes: this.geneticTree,
      roots: this.geneticRoots,
      size: this.geneticTree.size,
    };
  }

  /**
   * Рекурсивне отримання всіх нащадків заданого генотипу.
   */
  getDescendants(genomeId: GenomeId): GenomeId[] {
    const node = this.geneticTree.get(genomeId);
    if (!node) { return []; }

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
   * Відстеження філогенетичної лінії предків.
   */
  getAncestors(genomeId: GenomeId): GenomeId[] {
    const ancestors: GenomeId[] = [];
    let currentId: GenomeId | null = genomeId;

    while (currentId) {
      const node = this.geneticTree.get(currentId);
      if (!node || !node.parentId) { break; }

      ancestors.push(node.parentId);
      currentId = node.parentId;
    }

    return ancestors;
  }

  /**
   * Розрахунок інтегрального показника репродуктивної готовності популяції (Fertility Rate).
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
