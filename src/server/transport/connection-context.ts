/**
 * Per-connection bag for authenticated identity, addressing metadata, and arbitrary key/value context.
 */
import type { AuthContext } from '../../shared/types';
import type { ConnectionContext } from '../contracts';

export type { ConnectionContext };

export class DefaultConnectionContext implements ConnectionContext {
  readonly connectionId: string;
  readonly userId: string | null;
  readonly auth: AuthContext | null;
  readonly connectedAt: number;
  readonly remoteAddress: string;
  metadata: Record<string, unknown>;
  tags: Set<string>;

  private store = new Map<string, unknown>();

  constructor(opts: { connectionId: string; auth: AuthContext | null; remoteAddress: string }) {
    this.connectionId = opts.connectionId;
    this.auth = opts.auth;
    this.userId = opts.auth?.userId ?? null;
    this.connectedAt = Date.now();
    this.remoteAddress = opts.remoteAddress;
    this.metadata = opts.auth?.metadata ? { ...opts.auth.metadata } : {};
    this.tags = new Set();
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }
}
