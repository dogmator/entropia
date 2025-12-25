/**
 * Entropia 3D — Типобезпечна шина керування подіями (Event Bus).
 *
 * Реалізує патерн проєктування «Observer» (Спостерігач) для забезпечення слабкої зв'язності (loose coupling)
 * між функціональними компонентами системи. Забезпечує статичну типізацію подій за допомогою
 * генериків (Generics) TypeScript.
 */

import { SimulationEvent } from '../types';

/**
 * Визначення типу функції зворотного виклику (Callback) для опрацювання подій.
 */
type EventCallback<T extends SimulationEvent = SimulationEvent> = (event: T) => void;

/**
 * Тип функції для деактивації підписки.
 */
type Unsubscribe = () => void;

/**
 * Клас EventBus — централізований інтерфейс обміну повідомленнями.
 *
 * Архітектурне використання:
 * ```typescript
 * const eventBus = new EventBus();
 *
 * // Реєстрація обробника події
 * const unsubscribe = eventBus.on('TickUpdated', (event) => {
 *   console.log('Поточний тік:', event.tick);
 * });
 *
 * // Емісія (відправка) події
 * eventBus.emit({ type: 'TickUpdated', tick: 123, stats, deltaTime: 0.016 });
 *
 * // Елімінація підписки (очищення ресурсів)
 * unsubscribe();
 * ```
 */
export class EventBus {
  private readonly listeners: Map<string, Set<EventCallback>> = new Map();
  private readonly eventHistory: SimulationEvent[] = [];
  private readonly maxHistorySize: number = 100;

  /**
   * Реєстрація слухача для детермінованого типу події.
   *
   * @param eventType — Семантичний тип події (наприклад, 'TickUpdated').
   * @param callback — Делегат, що виконується при активації події.
   * @returns Коллбек-функція для термінації підписки.
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

    // Повернення механізму відписки
    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Реєстрація універсального слухача для всього стеку подій.
   *
   * @param callback — Функція обробки будь-яких системних сповіщень.
   * @returns Функція для анулювання глобальної підписки.
   */
  onAll(callback: EventCallback): Unsubscribe {
    const unsubscribers: Unsubscribe[] = [];

    // Ітеративна підписка на всі виявлені типи подій
    this.listeners.forEach((_, eventType) => {
      unsubscribers.push(this.on(eventType as SimulationEvent['type'], callback));
    });

    // Реєстрація обробника для майбутніх (динамічних) типів подій
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
   * Емісія події: розсилка повідомлення всім зареєстрованим реципієнтам.
   *
   * @param event — Об'єкт події, що містить корисне навантаження.
   */
  emit<T extends SimulationEvent>(event: T): void {
    // Фіксація події в журналі історії (буферизація)
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Дистрибуція події цільовим обробникам
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Критична помилка при опрацюванні події ${event.type}:`, error);
        }
      });
    }

    // Сповіщення глобальних спостерігачів
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Критична помилка у глобальному обробнику події ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Повна термінація всіх підписок та очищення буфера історії.
   */
  clear(): void {
    this.listeners.clear();
    this.clearHistory();
  }

  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Отримання поточної кількості активних слухачів для заданого типу події.
   */
  getListenerCount(eventType: SimulationEvent['type']): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Доступ до стеку останніх системних подій (режим читання).
   */
  getHistory(): ReadonlyArray<SimulationEvent> {
    return [...this.eventHistory];
  }

  /**
   * Ретроспективний пошук останнього інциденту вказаного типу.
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
   * Предикатна верифікація наявності активних спостерігачів для типу події.
   */
  hasListeners(eventType: SimulationEvent['type']): boolean {
    return this.getListenerCount(eventType) > 0;
  }
}
