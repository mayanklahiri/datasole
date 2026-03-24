/**
 * Auth handler: default is a pass-through that assigns connectionId + remoteAddress.
 * Production handlers can optionally use the backend for token/session lookup.
 */
import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../../shared/types';
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

import type { AuthHandlerConfig } from './types';

export interface AuthHandlerInterface {
  verify(req: IncomingMessage): Promise<AuthResult>;
}

export type AuthHandlerFn = (req: IncomingMessage) => Promise<AuthResult>;

/** Default pass-through auth: assigns connectionId from remote address, no token validation. */
export function createDefaultAuthHandler(): AuthHandlerFn {
  return async (req: IncomingMessage) => {
    const remoteAddress = req.socket.remoteAddress ?? 'unknown';
    return {
      authenticated: true,
      userId: remoteAddress,
      roles: [],
      metadata: {},
    };
  };
}

export function createAuthHandler(
  handler: AuthHandlerFn,
  _config?: AuthHandlerConfig,
  _backend?: StateBackend,
): AuthHandlerInterface & RealtimePrimitive {
  return {
    async verify(req: IncomingMessage): Promise<AuthResult> {
      try {
        return await handler(req);
      } catch {
        return { authenticated: false };
      }
    },
    async destroy(): Promise<void> {},
  };
}
