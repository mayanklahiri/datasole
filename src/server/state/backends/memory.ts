import { EventEmitter } from 'events';

import type { StateBackend, StateBackendOptions } from '../types';

export class MemoryBackend implements StateBackend {
  private store = new Map<string, unknown>();
  private emitter = new EventEmitter();

  constructor(_options?: StateBackendOptions) {}

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void {
    const listener = (value: unknown) => handler(key, value);
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }

  async publish(key: string, value: unknown): Promise<void> {
    this.emitter.emit(key, value);
  }
}
