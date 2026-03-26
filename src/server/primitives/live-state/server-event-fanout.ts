/**
 * Emit typed server events to local {@link EventBus} handlers and all WebSocket clients.
 */
import type { DatasoleContract } from '../../../shared/contract';
import type { BroadcastSink } from '../../protocol/broadcast-sink';
import type { EventBus } from '../events/event-bus';

export class ServerEventFanout<T extends DatasoleContract> {
  constructor(
    private readonly events: EventBus<T>,
    private readonly broadcastSink: BroadcastSink,
  ) {}

  /** Local dispatch + EVENT_S2C to every connection. */
  broadcast<K extends keyof T['events'] & string>(event: K, data: T['events'][K]): void {
    this.events.emit(event, data as never);
    this.broadcastSink.broadcastEvent(event, data);
  }
}
