export type EventName = string;

export interface EventPayload<T = unknown> {
  event: EventName;
  data: T;
  timestamp: number;
}

export type EventHandler<T = unknown> = (payload: EventPayload<T>) => void;
