import type { EventHandler, EventName } from '../../shared/types';

export class ClientEventEmitter {
  private handlers = new Map<EventName, Set<EventHandler>>();

  on<T = unknown>(event: EventName, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  off<T = unknown>(event: EventName, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit(event: EventName, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    const payload = { event, data, timestamp: Date.now() };
    for (const handler of handlers) {
      handler(payload);
    }
  }

  // TODO: wire to transport for server-bound events
}
