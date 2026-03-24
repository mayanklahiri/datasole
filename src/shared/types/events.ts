/**
 * Shared event types: event names, payloads, and handlers.
 */
export type EventName = string;

export interface EventPayload<T = unknown> {
  /** Logical event key. */
  event: EventName;
  /** Event payload data for the key. */
  data: T;
  /** Emission timestamp in unix milliseconds. */
  timestamp: number;
}

export type EventHandler<T = unknown> = (payload: EventPayload<T>) => void;
