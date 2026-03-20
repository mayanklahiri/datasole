/**
 * Coordinates get/set and diff-driven patches over a StateBackend, with subscribe/publish for reactive updates.
 */
import { diff } from '../../shared/diff';
import type { StatePatch } from '../../shared/types';

import type { StateBackend } from './types';

export class StateManager {
  constructor(private backend: StateBackend) {}

  async setState<T = unknown>(key: string, value: T): Promise<StatePatch[]> {
    const current = await this.backend.get(key);
    const patches = diff(current, value);
    await this.backend.set(key, value);
    await this.backend.publish(key, patches);
    return patches;
  }

  async getState<T = unknown>(key: string): Promise<T | undefined> {
    return this.backend.get<T>(key);
  }

  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void {
    return this.backend.subscribe(key, handler);
  }
}
