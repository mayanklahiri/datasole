/**
 * Upgrade-path auth: runs optional verification before a WebSocket is accepted.
 */
import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../shared/types';
import type { AuthHandlerFn } from '../contracts';

export type AuthHandler = AuthHandlerFn;

export async function handleUpgrade(
  req: IncomingMessage,
  authHandler?: AuthHandler,
): Promise<AuthResult> {
  if (!authHandler) {
    return { authenticated: true };
  }
  return authHandler(req);
}
