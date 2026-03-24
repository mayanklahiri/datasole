/**
 * Shared state types: patches, snapshots, and subscriptions.
 */
export interface StatePatch {
  /** RFC 6902 patch opcode. */
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  /** JSON pointer path. */
  path: string;
  /** Value payload for add/replace/test operations. */
  value?: unknown;
  /** Source pointer for move/copy operations. */
  from?: string;
}

export interface StateSnapshot<T = unknown> {
  /** Logical state key. */
  key: string;
  /** Monotonic snapshot version. */
  version: number;
  /** Full state payload at this version. */
  data: T;
}

export interface StateSubscription {
  /** Unsubscribe callback returned from subscribe methods. */
  unsubscribe: () => void;
}
