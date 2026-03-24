/**
 * Builds auth handler wrappers that honor required and allowAnonymous configuration when verifying upgrade requests.
 */
import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../shared/types';

import type { AuthHandlerConfig } from './types';

export interface AuthHandlerInterface {
  verify(req: IncomingMessage): Promise<AuthResult>;
}

export function createAuthHandler(
  handler: (req: IncomingMessage) => Promise<AuthResult>,
  config?: AuthHandlerConfig,
): AuthHandlerInterface {
  const required = config?.required ?? true;
  const allowAnonymous = config?.allowAnonymous ?? false;

  return {
    async verify(req: IncomingMessage): Promise<AuthResult> {
      try {
        const result = await handler(req);
        if (!result.authenticated && required && !allowAnonymous) {
          return { authenticated: false };
        }
        return result;
      } catch {
        // Auth handler errors always deny access — never escalate to authenticated.
        return { authenticated: false };
      }
    },
  };
}
