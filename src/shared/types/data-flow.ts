export type DataFlowPattern =
  | 'rpc'
  | 'server-event'
  | 'client-event'
  | 'bidirectional-event'
  | 'server-live-state'
  | 'client-live-state'
  | 'bidirectional-crdt';

export type SyncGranularity = 'immediate' | 'batched' | 'debounced' | 'manual';

export interface LiveStateConfig<T = unknown> {
  key: string;
  pattern: DataFlowPattern;
  granularity: SyncGranularity;
  initialValue?: T;
  batchIntervalMs?: number;
  debounceMs?: number;
}

export interface LiveStateHandle<T = unknown> {
  readonly key: string;
  readonly pattern: DataFlowPattern;

  get(): T;
  set(value: T): void;
  update(updater: (current: T) => T): void;
  subscribe(handler: (value: T) => void): () => void;
}

export interface DataChannel {
  readonly pattern: DataFlowPattern;
  readonly key: string;
  readonly active: boolean;

  close(): void;
}
