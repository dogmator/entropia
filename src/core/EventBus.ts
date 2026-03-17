/**
 * Entropia 3D — Типобезпечна шина керування подіями (Event Bus).
 *
 * Реалізує патерн проєктування «Observer» (Спостерігач) для забезпечення слабкої зв'язності (loose coupling)
 * між функціональними компонентами системи. Забезпечує статичну типізацію подій за допомогою
 * генериків (Generics) TypeScript.
 */

import type { SimulationEvent } from '@/types';

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
  private readonly eventHistory: Array<SimulationEvent | undefined> = [];
  private historyStart: number = 0;
  private historySize: number = 0;
  private readonly maxHistorySize: number = 100;

  private appendToHistory(event: SimulationEvent): void {
    if (this.historySize < this.maxHistorySize) {
      const writeIndex = (this.historyStart + this.historySize) % this.maxHistorySize;
      this.eventHistory[writeIndex] = event;
      this.historySize += 1;
      return;
    }

    this.eventHistory[this.historyStart] = event;
    this.historyStart = (this.historyStart + 1) % this.maxHistorySize;
  }

  private readHistory(index: number): SimulationEvent | undefined {
    const normalizedIndex = (this.historyStart + index) % this.maxHistorySize;
    return this.eventHistory[normalizedIndex];
  }

  /**
   * Реєстрація слухача для детермінованого типу події.
   *
   * @param eventType — Семантичний тип події (наприклад, 'TickUpdated').
   * @param callback — Делегат, що виконується при активації події.
   * @returns Коллбек-функція для термінації підписки.
   */
  public on<T extends SimulationEvent>(
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
  public onAll(callback: EventCallback): Unsubscribe {
    // Реєстрація єдиного глобального обробника для всіх поточних і майбутніх подій.
    // Додаткові точкові підписки на кожен тип не потрібні, бо emit() окремо дистрибутує '*'.
    // Це запобігає дублюванню callback-викликів і зайвому O(k) memory footprint для k типів подій.
    const globalCallbacks = this.listeners.get('*') || new Set();
    globalCallbacks.add(callback);
    this.listeners.set('*', globalCallbacks);

    return () => {
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
  public emit<T extends SimulationEvent>(event: T): void {
    // Фіксація події в журналі історії (кільцевий буфер O(1))
    this.appendToHistory(event);

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
  public clear(): void {
    this.listeners.clear();
    this.clearHistory();
  }

  public clearHistory(): void {
    this.eventHistory.length = 0;
    this.historyStart = 0;
    this.historySize = 0;
  }

  /**
   * Отримання поточної кількості активних слухачів для заданого типу події.
   */
  public getListenerCount(eventType: SimulationEvent['type']): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Доступ до стеку останніх системних подій (режим читання).
   */
  public getHistory(): ReadonlyArray<SimulationEvent> {
    const history: SimulationEvent[] = [];
    for (let i = 0; i < this.historySize; i++) {
      const event = this.readHistory(i);
      if (event) {
        history.push(event);
      }
    }
    return history;
  }

  /**
   * Ретроспективний пошук останнього інциденту вказаного типу.
   */
  public getLastEvent<T extends SimulationEvent>(eventType: T['type']): T | null {
    for (let i = this.historySize - 1; i >= 0; i--) {
      const event = this.readHistory(i);
      if (event && event.type === eventType) {
        return event as T;
      }
    }
    return null;
  }

  /**
   * Предикатна верифікація наявності активних спостерігачів для типу події.
   */
  public hasListeners(eventType: SimulationEvent['type']): boolean {
    return this.getListenerCount(eventType) > 0;
  }
}
