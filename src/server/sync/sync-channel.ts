/**
 * Buffers state patches for a logical channel and flushes them on a schedule according to the configured strategy.
 */
import type { StatePatch } from '../../shared/types';

import type { SyncChannelConfig } from './types';

export class SyncChannel<T = unknown> {
  readonly key: string;
  readonly config: SyncChannelConfig<T>;

  private pendingPatches: StatePatch[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(patches: StatePatch[]) => void>();

  constructor(config: SyncChannelConfig<T>) {
    this.key = config.key;
    this.config = config;
  }

  enqueue(patches: StatePatch[]): void {
    this.pendingPatches.push(...patches);
    this.scheduleFlush();
  }

  onFlush(listener: (patches: StatePatch[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  flush(): void {
    if (this.pendingPatches.length === 0) return;
    const patches = this.pendingPatches.splice(0);
    for (const listener of this.listeners) {
      listener(patches);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    this.listeners.clear();
  }

  private scheduleFlush(): void {
    const strategy = this.config.flush.flushStrategy;

    if (strategy === 'immediate') {
      this.flush();
      return;
    }

    if (strategy === 'debounced') {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), this.config.flush.debounceMs ?? 50);
      return;
    }

    if (strategy === 'batched') {
      const maxBatch = this.config.flush.maxBatchSize ?? 100;
      if (this.pendingPatches.length >= maxBatch) {
        this.flush();
        return;
      }
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          this.flush();
        }, this.config.flush.batchIntervalMs ?? 100);
      }
    }
  }
}
