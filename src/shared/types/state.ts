export interface StatePatch {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

export interface StateSnapshot<T = unknown> {
  key: string;
  version: number;
  data: T;
}

export interface StateSubscription {
  unsubscribe: () => void;
}
