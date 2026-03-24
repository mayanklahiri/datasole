/**
 * Server-side event bus: publish/subscribe powered by the StateBackend for cross-instance delivery.
 */
import type { DatasoleContract, EventData } from '../../../shared/contract';
import type { EventPayload } from '../../../shared/types';
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

type InternalHandler = (payload: EventPayload) => void;

export class EventBus<T extends DatasoleContract> implements RealtimePrimitive {
  private handlers = new Map<string, Set<InternalHandler>>();
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly backend: StateBackend) {}

  on<K extends keyof T['events'] & string>(
    event: K,
    handler: (payload: EventPayload<EventData<T, K>>) => void,
  ): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
      const unsub = this.backend.subscribe(`evt:${event}`, (_key, value) => {
        const payload = value as EventPayload;
        const handlers = this.handlers.get(event);
        if (!handlers) return;
        for (const h of handlers) {
          try {
            h(payload);
          } catch {
            // Isolate handler errors.
          }
        }
      });
      this.unsubscribers.push(unsub);
    }
    this.handlers.get(event)!.add(handler as InternalHandler);
  }

  off<K extends keyof T['events'] & string>(
    event: K,
    handler: (payload: EventPayload<EventData<T, K>>) => void,
  ): void {
    this.handlers.get(event)?.delete(handler as InternalHandler);
  }

  emit<K extends keyof T['events'] & string>(event: K, data: EventData<T, K>): void {
    const payload: EventPayload = { event, data, timestamp: Date.now() };
    // Publish to backend — the subscription set up in on() delivers to all handlers.
    // This works correctly for both MemoryBackend (local) and Redis/Postgres (distributed).
    void this.backend.publish(`evt:${event}`, payload);
  }

  async destroy(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.handlers.clear();
  }
}
