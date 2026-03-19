import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../shared/types';

export type AuthHandler = (req: IncomingMessage) => Promise<AuthResult>;

export async function handleUpgrade(
  req: IncomingMessage,
  authHandler?: AuthHandler,
): Promise<AuthResult> {
  if (!authHandler) {
    return { authenticated: true };
  }
  return authHandler(req);
}
