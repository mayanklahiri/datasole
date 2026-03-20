/**
 * Positive-negative counter CRDT with distributed increment and decrement.
 */
import type { Crdt, CrdtOperation, CrdtState } from './types';

export interface PNCounterVector {
  increments: Record<string, number>;
  decrements: Record<string, number>;
}

export class PNCounter implements Crdt<number> {
  readonly type = 'pn-counter' as const;
  private increments = new Map<string, number>();
  private decrements = new Map<string, number>();
  private _version = 0;

  constructor(readonly nodeId: string) {
    this.increments.set(nodeId, 0);
    this.decrements.set(nodeId, 0);
  }

  value(): number {
    let total = 0;
    for (const v of this.increments.values()) total += v;
    for (const v of this.decrements.values()) total -= v;
    return total;
  }

  vector(): PNCounterVector {
    const inc: Record<string, number> = {};
    const dec: Record<string, number> = {};
    for (const [k, v] of this.increments) inc[k] = v;
    for (const [k, v] of this.decrements) dec[k] = v;
    return { increments: inc, decrements: dec };
  }

  increment(amount = 1): CrdtOperation<number> {
    this.increments.set(this.nodeId, (this.increments.get(this.nodeId) ?? 0) + amount);
    this._version++;
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      op: 'increment',
      value: amount,
    };
  }

  decrement(amount = 1): CrdtOperation<number> {
    this.decrements.set(this.nodeId, (this.decrements.get(this.nodeId) ?? 0) + amount);
    this._version++;
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      op: 'decrement',
      value: amount,
    };
  }

  apply(op: CrdtOperation<number>): void {
    const amount = (op.value as number) ?? 1;
    if (op.op === 'increment') {
      this.increments.set(op.nodeId, (this.increments.get(op.nodeId) ?? 0) + amount);
    } else if (op.op === 'decrement') {
      this.decrements.set(op.nodeId, (this.decrements.get(op.nodeId) ?? 0) + amount);
    }
    this._version++;
  }

  merge(remote: CrdtState<number>): void {
    const rv = (remote.metadata as unknown as { vector?: PNCounterVector })?.vector;
    if (rv) {
      for (const [nodeId, count] of Object.entries(rv.increments)) {
        this.increments.set(nodeId, Math.max(this.increments.get(nodeId) ?? 0, count));
      }
      for (const [nodeId, count] of Object.entries(rv.decrements)) {
        this.decrements.set(nodeId, Math.max(this.decrements.get(nodeId) ?? 0, count));
      }
    }
    this._version++;
  }

  state(): CrdtState<number> {
    return {
      type: this.type,
      value: this.value(),
      metadata: {
        type: this.type,
        nodeId: this.nodeId,
        timestamp: Date.now(),
        version: this._version,
        vector: this.vector(),
      } as CrdtState<number>['metadata'] & { vector: PNCounterVector },
    };
  }
}
