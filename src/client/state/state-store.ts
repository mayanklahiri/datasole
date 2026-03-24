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

  /** Return current local snapshot value. */
  getState(): T {
    return this.state;
  }

  /** Apply RFC 6902 patch list and notify subscribers. */
  applyPatches(patches: StatePatch[]): void {
    this.state = applyPatch(this.state, patches);
    this.notify();
  }

  /** Subscribe to state updates and receive an unsubscribe handle. */
  subscribe(handler: (state: T) => void): StateSubscription {
    this.subscribers.add(handler);
    try {
      handler(this.state);
    } catch {
      // Same isolation as notify — bad handlers must not break subscribe.
    }
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
