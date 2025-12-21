/**
 * EVOSIM 3D — Типобезпечна Шина Подій (Event Bus)
 *
 * Реалізує Observer Pattern для відправки подій між компонентами системи.
 * Забезпечує повну типобезпеку через TypeScript generics.
 */

import { SimulationEvent } from '../types';

/**
 * Callback функція для обробки події
 */
type EventCallback<T extends SimulationEvent = SimulationEvent> = (event: T) => void;

/**
 * Функція відписки від події
 */
type Unsubscribe = () => void;

/**
 * EventBus - централізована система подій
 *
 * Використання:
 * ```typescript
 * const eventBus = new EventBus();
 *
 * // Підписка на події
 * const unsubscribe = eventBus.on('TickUpdated', (event) => {
 *   console.log('Tick:', event.tick);
 * });
 *
 * // Відправка події
 * eventBus.emit({ type: 'TickUpdated', tick: 123, stats, deltaTime: 0.016 });
 *
 * // Відписка
 * unsubscribe();
 * ```
 */
export class EventBus {
  private readonly listeners: Map<string, Set<EventCallback>> = new Map();
  private readonly eventHistory: SimulationEvent[] = [];
  private readonly maxHistorySize: number = 100;

  /**
   * Підписатися на події конкретного типу
   *
   * @param eventType - Тип події (наприклад, 'TickUpdated')
   * @param callback - Функція обробки події
   * @returns Функція для відписки
   */
  on<T extends SimulationEvent>(
    eventType: T['type'],
    callback: EventCallback<T>
  ): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const callbacks = this.listeners.get(eventType)!;
    callbacks.add(callback as EventCallback);

    // Повернути функцію відписки
    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Підписатися на всі події
   *
   * @param callback - Функція обробки будь-якої події
   * @returns Функція для відписки
   */
  onAll(callback: EventCallback): Unsubscribe {
    const unsubscribers: Unsubscribe[] = [];

    // Підписатися на всі існуючі типи подій
    this.listeners.forEach((_, eventType) => {
      unsubscribers.push(this.on(eventType as SimulationEvent['type'], callback));
    });

    // Зберегти callback для майбутніх типів
    const globalCallbacks = this.listeners.get('*') || new Set();
    globalCallbacks.add(callback);
    this.listeners.set('*', globalCallbacks);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      globalCallbacks.delete(callback);
      if (globalCallbacks.size === 0) {
        this.listeners.delete('*');
      }
    };
  }

  /**
   * Відправити подію всім підписникам
   *
   * @param event - Подія для відправки
   */
  emit<T extends SimulationEvent>(event: T): void {
    // Додати до історії подій
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Відправити конкретним слухачам
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Помилка обробки події ${event.type}:`, error);
        }
      });
    }

    // Відправити глобальним слухачам
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Помилка глобального обробника події ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Очистити всі підписки
   */
  clear(): void {
    this.listeners.clear();
    this.eventHistory.length = 0;
  }

  /**
   * Отримати кількість підписників на конкретний тип події
   */
  getListenerCount(eventType: SimulationEvent['type']): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Отримати історію подій
   */
  getHistory(): ReadonlyArray<SimulationEvent> {
    return [...this.eventHistory];
  }

  /**
   * Отримати останню подію певного типу
   */
  getLastEvent<T extends SimulationEvent>(eventType: T['type']): T | null {
    for (let i = this.eventHistory.length - 1; i >= 0; i--) {
      if (this.eventHistory[i].type === eventType) {
        return this.eventHistory[i] as T;
      }
    }
    return null;
  }

  /**
   * Перевірити чи є підписники на подію
   */
  hasListeners(eventType: SimulationEvent['type']): boolean {
    return this.getListenerCount(eventType) > 0;
  }
}
