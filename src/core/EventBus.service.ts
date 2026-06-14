/**
 * Entropia 3D — Type-safe event management bus (Event Bus).
 *
 * Implements the "Observer" design pattern to ensure loose coupling
 * between functional system components. Provides static typing of events using
 * TypeScript Generics.
 */

import type { SimulationEvent } from '@/types';

/**
 * Definition of Callback function type for event processing.
 */
type EventCallback<T extends SimulationEvent = SimulationEvent> = (event: T) => void;

/**
 * Type of function to deactivate a subscription.
 */
type Unsubscribe = () => void;

/**
 * EventBus class — centralized messaging interface.
 *
 * Architectural usage:
 * ```typescript
 * const eventBus = new EventBus();
 *
 * // Register event handler
 * const unsubscribe = eventBus.on('TickUpdated', (event) => {
 *   console.log('Current tick:', event.tick);
 * });
 *
 * // Emit (send) event
 * eventBus.emit({ type: 'TickUpdated', tick: 123, stats, deltaTime: 0.016 });
 *
 * // Eliminate subscription (resource cleanup)
 * unsubscribe();
 * ```
 */
export class EventBus {
  private readonly listeners = new Map<string, Set<EventCallback>>();
  private readonly eventHistory: (SimulationEvent | undefined)[] = [];
  private historyStart = 0;
  private historySize = 0;
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
   * Registering a listener for a deterministic event type.
   *
   * @param eventType — Semantic event type (e.g., 'TickUpdated').
   * @param callback — Delegate executed upon event activation.
   * @returns Callback function for terminating the subscription.
   */
  public on<T extends SimulationEvent>(
    eventType: T['type'],
    callback: EventCallback<T>
  ): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const callbacks = this.listeners.get(eventType)!;
    callbacks.add(callback as EventCallback);

    // Return unsubscribe mechanism
    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Registering a universal listener for the entire event stack.
   *
   * @param callback — Function for processing any system notifications.
   * @returns Function to cancel the global subscription.
   */
  public onAll(callback: EventCallback): Unsubscribe {
    // Register a single global handler for all current and future events.
    // Additional point-to-point subscriptions for each type are not needed, because emit() separately distributes '*'.
    // This prevents duplicate callback calls and unnecessary O(k) memory footprint for k event types.
    const globalCallbacks = this.listeners.get('*') ?? new Set<EventCallback>();
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
   * Emitting an event: broadcasting the message to all registered recipients.
   *
   * @param event — Event object containing the payload.
   */
  public emit(event: SimulationEvent): void {
    // Recording the event in the history log (circular buffer O(1))
    this.appendToHistory(event);

    // Distributing the event to target handlers
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Critical error while processing event ${event.type}:`, error);
        }
      });
    }

    // Notifying global observers
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Critical error in global handler for event ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Complete termination of all subscriptions and history buffer cleanup.
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
   * Getting the current number of active listeners for a given event type.
   */
  public getListenerCount(eventType: SimulationEvent['type']): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  /**
   * Access to the stack of recent system events (read-only mode).
   */
  public getHistory(): readonly SimulationEvent[] {
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
   * Retrospective search for the last incident of the specified type.
   */
  public getLastEvent<T extends SimulationEvent>(eventType: T['type']): T | null {
    for (let i = this.historySize - 1; i >= 0; i--) {
      const event = this.readHistory(i);
      if (event?.type === eventType) {
        return event as T;
      }
    }
    return null;
  }

  /**
   * Predicate verification of active observers for an event type.
   */
  public hasListeners(eventType: SimulationEvent['type']): boolean {
    return this.getListenerCount(eventType) > 0;
  }
}
