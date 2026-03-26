/**
 * Backend-powered CRDT registry: persists state via StateBackend, syncs across instances via pub/sub.
 */
import type { Crdt, CrdtOperation, CrdtState } from '../../../shared/crdt';
import { LWWMap, LWWRegister, PNCounter } from '../../../shared/crdt';
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

export class CrdtManager implements RealtimePrimitive {
  private registry = new Map<string, Crdt>();
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly backend: StateBackend,
    private readonly maxKeys: number = 1_000,
  ) {}

  /** Register an explicit CRDT instance for a key and subscribe backend updates. */
  register(key: string, crdt: Crdt): void {
    this.registry.set(key, crdt);
    const unsub = this.backend.subscribe(`crdt:${key}`, (_k, value) => {
      const remoteCrdt = this.registry.get(key);
      if (remoteCrdt) {
        remoteCrdt.apply(value as CrdtOperation);
      }
    });
    this.unsubscribers.push(unsub);
  }

  /** Register a CRDT by symbolic type name. */
  registerByType(key: string, type: string): void {
    if (this.registry.has(key)) return;
    let crdt: Crdt;
    switch (type) {
      case 'pn-counter':
        crdt = new PNCounter('server');
        break;
      case 'lww-register':
        crdt = new LWWRegister('server', undefined, 0);
        break;
      case 'lww-map':
        crdt = new LWWMap('server');
        break;
      default:
        return;
    }
    this.register(key, crdt);
  }

  /** Apply an incoming CRDT operation and persist/broadcast merged state. */
  apply(connectionId: string, op: CrdtOperation): { key: string; state: CrdtState } | null {
    const key = op.key ?? connectionId;
    let crdt = this.registry.get(key);
    if (!crdt) {
      if (this.registry.size >= this.maxKeys) return null;
      this.registerByType(key, op.type);
      crdt = this.registry.get(key);
      if (!crdt) return null;
    }
    crdt.apply(op);
    const state = crdt.state();
    void this.backend.set(`crdt:${key}`, state);
    void this.backend.publish(`crdt:${key}`, op);
    return { key, state };
  }

  /** Return current CRDT state for a key if registered. */
  getState(key: string): CrdtState | undefined {
    return this.registry.get(key)?.state();
  }

  /** Clear subscriptions and in-memory registry. */
  async destroy(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.registry.clear();
  }
}
