/**
 * Client-side state store: holds server-synced state, applies JSON patches, notifies subscribers.
 */

import { applyPatch } from '../../shared/diff';
import type { StatePatch, StateSubscription } from '../../shared/types';

export class StateStore<T = unknown> {
  private state: T;
  private subscribers = new Set<(state: T) => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  getState(): T {
    return this.state;
  }

  applyPatches(patches: StatePatch[]): void {
    this.state = applyPatch(this.state, patches);
    this.notify();
  }

  subscribe(handler: (state: T) => void): StateSubscription {
    this.subscribers.add(handler);
    return {
      unsubscribe: () => this.subscribers.delete(handler),
    };
  }

  private notify(): void {
    for (const handler of this.subscribers) {
      try {
        handler(this.state);
      } catch {
        // Isolate subscriber errors so one bad subscriber does not block others.
      }
    }
  }
}
