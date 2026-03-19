import type { Crdt, CrdtOperation, CrdtState, CrdtMetadata } from './types';

export class LWWRegister<T = unknown> implements Crdt<T> {
  readonly type = 'lww-register' as const;
  private _value: T;
  private _timestamp: number;
  private _version = 0;

  constructor(
    readonly nodeId: string,
    initialValue: T,
    timestamp = Date.now(),
  ) {
    this._value = initialValue;
    this._timestamp = timestamp;
  }

  value(): T {
    return this._value;
  }

  set(newValue: T, timestamp = Date.now()): CrdtOperation<T> {
    if (timestamp >= this._timestamp) {
      this._value = newValue;
      this._timestamp = timestamp;
      this._version++;
    }
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp,
      op: 'set',
      value: newValue,
    };
  }

  apply(op: CrdtOperation<T>): void {
    if (op.timestamp >= this._timestamp) {
      this._value = op.value as T;
      this._timestamp = op.timestamp;
      this._version++;
    }
  }

  merge(remote: CrdtState<T>): void {
    if (
      remote.metadata.timestamp > this._timestamp ||
      (remote.metadata.timestamp === this._timestamp && remote.metadata.nodeId > this.nodeId)
    ) {
      this._value = remote.value;
      this._timestamp = remote.metadata.timestamp;
      this._version = Math.max(this._version, remote.metadata.version) + 1;
    }
  }

  state(): CrdtState<T> {
    return {
      type: this.type,
      value: this._value,
      metadata: this.metadata(),
    };
  }

  private metadata(): CrdtMetadata {
    return {
      type: this.type,
      nodeId: this.nodeId,
      timestamp: this._timestamp,
      version: this._version,
    };
  }
}
