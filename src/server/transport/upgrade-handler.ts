import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../shared/types';

export type AuthHandler = (req: IncomingMessage) => Promise<AuthResult>;

export async function handleUpgrade(
  _req: IncomingMessage,
  _authHandler?: AuthHandler,
): Promise<AuthResult> {
  // TODO: extract credentials, call auth handler, return result
  return { authenticated: true };
}
