/**
 * Ephemeral StateBackend backed by an in-memory Map with Map-based key subscriptions.
 *
 * Uses a plain Map<string, Set<Function>> instead of EventEmitter to avoid the
 * Node.js EventEmitter special-casing of the "error" event name (which throws
 * if emitted with no listener and can crash the process with user-controlled keys).
 */
import type { StateBackend, StateBackendOptions } from '../types';

type Listener = (value: unknown) => void;

export class MemoryBackend implements StateBackend {
  private store = new Map<string, unknown>();
  private listeners = new Map<string, Set<Listener>>();

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
    const listener: Listener = (value: unknown) => handler(key, value);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(key);
      }
    };
  }

  async publish(key: string, value: unknown): Promise<void> {
    const set = this.listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(value);
      } catch {
        // Isolate listener errors.
      }
    }
  }
}
