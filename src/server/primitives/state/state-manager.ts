/**
 * Coordinates get/set and diff-driven patches over a StateBackend, with subscribe/publish for reactive updates.
 */
import type { DatasoleContract, StateValue } from '../../../shared/contract';
import { diff } from '../../../shared/diff';
import type { StatePatch } from '../../../shared/types';
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

export class StateManager<T extends DatasoleContract> implements RealtimePrimitive {
  constructor(private backend: StateBackend) {}

  async setState<K extends keyof T['state'] & string>(
    key: K,
    value: StateValue<T, K>,
  ): Promise<StatePatch[]> {
    const current = await this.backend.get(key);
    const patches = diff(current, value);
    await this.backend.set(key, value);
    await this.backend.publish(key, patches);
    return patches;
  }

  async getState<K extends keyof T['state'] & string>(
    key: K,
  ): Promise<StateValue<T, K> | undefined> {
    return this.backend.get<StateValue<T, K>>(key);
  }

  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void {
    return this.backend.subscribe(key, handler);
  }

  async destroy(): Promise<void> {
    // StateManager has no internal resources beyond the backend reference
  }
}
