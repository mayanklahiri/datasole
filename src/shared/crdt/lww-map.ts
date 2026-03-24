/**
 * Last-writer-wins map CRDT built on LWWRegister entries.
 */
import { LWWRegister } from './lww-register';
import type { Crdt, CrdtOperation, CrdtState } from './types';

export class LWWMap<T = unknown> implements Crdt<Record<string, T>> {
  readonly type = 'lww-map' as const;
  private fields = new Map<string, LWWRegister<T | undefined>>();
  private _version = 0;

  constructor(readonly nodeId: string) {}

  value(): Record<string, T> {
    const result = Object.create(null) as Record<string, T>;
    for (const [key, register] of this.fields) {
      const v = register.value();
      if (v !== undefined) result[key] = v;
    }
    return result;
  }

  get(key: string): T | undefined {
    return this.fields.get(key)?.value();
  }

  set(key: string, val: T, timestamp = Date.now()): CrdtOperation<T> {
    let register = this.fields.get(key);
    if (!register) {
      register = new LWWRegister(this.nodeId, val, timestamp);
      this.fields.set(key, register);
    } else {
      register.set(val, timestamp);
    }
    this._version++;
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp,
      op: 'set',
      key,
      value: val,
    };
  }

  delete(key: string, timestamp = Date.now()): CrdtOperation<T> {
    const register = this.fields.get(key);
    if (register) {
      register.set(undefined as T | undefined, timestamp);
    }
    this._version++;
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp,
      op: 'remove',
      key,
    };
  }

  apply(op: CrdtOperation<T>): void {
    if (op.op === 'set' && op.key) {
      this.set(op.key, op.value as T, op.timestamp);
    } else if (op.op === 'remove' && op.key) {
      this.delete(op.key, op.timestamp);
    }
  }

  merge(remote: CrdtState<Record<string, T>>): void {
    if (!remote?.metadata || typeof remote.metadata.timestamp !== 'number') return;
    if (!remote.value || typeof remote.value !== 'object') return;
    const entries = Object.entries(remote.value);
    if (entries.length > 10_000) {
      throw new Error(`LWWMap merge too large: ${entries.length} entries`);
    }
    for (const [key, val] of entries) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      this.set(key, val, remote.metadata.timestamp);
    }
    this._version++;
  }

  state(): CrdtState<Record<string, T>> {
    return {
      type: this.type,
      value: this.value(),
      metadata: {
        type: this.type,
        nodeId: this.nodeId,
        timestamp: Date.now(),
        version: this._version,
      },
    };
  }
}
