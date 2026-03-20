/**
 * Sync channel configuration types: flush strategies, batching options, sync direction, and patch modes.
 */
export type FlushStrategy = 'immediate' | 'batched' | 'debounced';

export interface SyncChannelOptions {
  flushStrategy: FlushStrategy;
  batchIntervalMs?: number;
  debounceMs?: number;
  maxBatchSize?: number;
}

export type SyncDirection = 'server-to-client' | 'client-to-server' | 'bidirectional';

export type SyncMode = 'json-patch' | 'crdt' | 'snapshot';

export interface SyncChannelConfig<T = unknown> {
  key: string;
  direction: SyncDirection;
  mode: SyncMode;
  flush: SyncChannelOptions;
  initialValue?: T;
}

export const DEFAULT_SYNC_OPTIONS: SyncChannelOptions = {
  flushStrategy: 'immediate',
  batchIntervalMs: 100,
  debounceMs: 50,
  maxBatchSize: 100,
};
