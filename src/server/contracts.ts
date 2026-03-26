/**
 * Container-level contracts: interfaces shared across all server layers.
 * Any layer may import from this file; it has no intra-server dependencies.
 */
import type { IncomingMessage } from 'http';

import type { AuthContext, AuthResult } from '../shared/types';

export interface ConnectionContext {
  readonly connectionId: string;
  readonly userId: string | null;
  readonly auth: AuthContext | null;
  readonly connectedAt: number;
  readonly remoteAddress: string;

  metadata: Record<string, unknown>;
  tags: Set<string>;

  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  delete(key: string): boolean;
}

export type AuthHandlerFn = (req: IncomingMessage) => Promise<AuthResult>;
