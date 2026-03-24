/**
 * Data flow pattern types: sync granularity, live state config, and data channels.
 */
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
  /** Logical channel key. */
  key: string;
  /** Pattern to instantiate for the key. */
  pattern: DataFlowPattern;
  /** Flush timing model for sync behavior. */
  granularity: SyncGranularity;
  /** Optional initial value used when channel is created. */
  initialValue?: T;
  /** Batch interval (ms) when granularity is `batched`. */
  batchIntervalMs?: number;
  /** Debounce interval (ms) when granularity is `debounced`. */
  debounceMs?: number;
}

export interface LiveStateHandle<T = unknown> {
  /** Channel key. */
  readonly key: string;
  /** Channel pattern. */
  readonly pattern: DataFlowPattern;

  /** Get latest local value. */
  get(): T;
  /** Replace value. */
  set(value: T): void;
  /** Update value using current value callback. */
  update(updater: (current: T) => T): void;
  /** Subscribe to value updates. Returns unsubscribe callback. */
  subscribe(handler: (value: T) => void): () => void;
}

export interface DataChannel {
  /** Pattern backing this channel. */
  readonly pattern: DataFlowPattern;
  /** Logical channel key. */
  readonly key: string;
  /** Whether the channel is currently active. */
  readonly active: boolean;

  /** Close and release channel resources. */
  close(): void;
}
