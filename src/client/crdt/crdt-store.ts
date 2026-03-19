import type { CrdtOperation, CrdtState, Crdt } from '../../shared/crdt';
import { LWWRegister, LWWMap, PNCounter } from '../../shared/crdt';

export class CrdtStore {
  private crdts = new Map<string, Crdt>();
  private pendingOps: CrdtOperation[] = [];
  private listeners = new Set<(ops: CrdtOperation[]) => void>();

  readonly nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  register<T>(key: string, type: 'lww-register', initialValue: T): LWWRegister<T>;
  register(key: string, type: 'pn-counter'): PNCounter;
  register<T>(key: string, type: 'lww-map'): LWWMap<T>;
  register<T>(key: string, type: string, initialValue?: T): Crdt {
    let crdt: Crdt;
    switch (type) {
      case 'lww-register':
        crdt = new LWWRegister(this.nodeId, initialValue);
        break;
      case 'pn-counter':
        crdt = new PNCounter(this.nodeId);
        break;
      case 'lww-map':
        crdt = new LWWMap(this.nodeId);
        break;
      default:
        throw new Error(`Unknown CRDT type: ${type}`);
    }
    this.crdts.set(key, crdt);
    return crdt;
  }

  get<T extends Crdt>(key: string): T | undefined {
    return this.crdts.get(key) as T | undefined;
  }

  applyRemote(key: string, op: CrdtOperation): void {
    const crdt = this.crdts.get(key);
    if (crdt) {
      crdt.apply(op);
    }
  }

  mergeRemoteState(key: string, state: CrdtState): void {
    const crdt = this.crdts.get(key);
    if (crdt) {
      crdt.merge(state);
    }
  }

  queueOperation(op: CrdtOperation): void {
    this.pendingOps.push(op);
    for (const listener of this.listeners) {
      listener([op]);
    }
  }

  drainPendingOps(): CrdtOperation[] {
    return this.pendingOps.splice(0);
  }

  onOps(handler: (ops: CrdtOperation[]) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  snapshot(): Record<string, CrdtState> {
    const result: Record<string, CrdtState> = {};
    for (const [key, crdt] of this.crdts) {
      result[key] = crdt.state();
    }
    return result;
  }
}
