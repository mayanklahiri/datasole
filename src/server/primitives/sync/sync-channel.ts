/**
 * Buffers state patches for a logical channel and flushes them on a schedule.
 * Optionally coordinates with a StateBackend for cross-instance patch inclusion.
 */
import type { StatePatch } from '../../../shared/types';
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

import type { SyncChannelConfig } from './types';

export class SyncChannel<T = unknown> implements RealtimePrimitive {
  readonly key: string;
  readonly config: SyncChannelConfig<T>;

  private pendingPatches: StatePatch[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(patches: StatePatch[]) => void>();
  private backendUnsub: (() => void) | null = null;

  constructor(config: SyncChannelConfig<T>, backend?: StateBackend) {
    this.key = config.key;
    this.config = config;

    if (backend) {
      this.backendUnsub = backend.subscribe(`sync:${config.key}`, (_key, value) => {
        const patches = value as StatePatch[];
        if (patches && Array.isArray(patches)) {
          this.pendingPatches.push(...patches);
          this.scheduleFlush();
        }
      });
    }
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

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    this.listeners.clear();
    if (this.backendUnsub) {
      this.backendUnsub();
      this.backendUnsub = null;
    }
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
