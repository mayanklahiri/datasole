export type CrdtType = 'g-counter' | 'pn-counter' | 'g-set' | 'or-set' | 'lww-register' | 'lww-map';

export interface CrdtMetadata {
  type: CrdtType;
  nodeId: string;
  timestamp: number;
  version: number;
}

export interface CrdtOperation<T = unknown> {
  type: CrdtType;
  nodeId: string;
  timestamp: number;
  op: 'increment' | 'decrement' | 'add' | 'remove' | 'set';
  key?: string;
  value?: T;
}

export interface CrdtState<T = unknown> {
  type: CrdtType;
  value: T;
  metadata: CrdtMetadata;
}

export interface Crdt<T = unknown> {
  readonly type: CrdtType;
  readonly nodeId: string;

  value(): T;
  apply(op: CrdtOperation): void;
  merge(remote: CrdtState<T>): void;
  state(): CrdtState<T>;
}

export interface CrdtDocument {
  id: string;
  fields: Map<string, Crdt>;
  version: number;

  get<T>(field: string): T | undefined;
  set(field: string, value: unknown): CrdtOperation;
  merge(remoteState: Record<string, CrdtState>): CrdtOperation[];
  snapshot(): Record<string, CrdtState>;
}
