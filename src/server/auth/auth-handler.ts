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
        if (allowAnonymous) {
          return { authenticated: true, userId: 'anonymous' };
        }
        return { authenticated: false };
      }
    },
  };
}
