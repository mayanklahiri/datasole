import type { IncomingMessage } from 'http';

import type { AuthResult } from '../../shared/types';

import type { AuthHandlerConfig } from './types';

export interface AuthHandlerInterface {
  verify(req: IncomingMessage): Promise<AuthResult>;
}

export function createAuthHandler(
  _handler: (req: IncomingMessage) => Promise<AuthResult>,
  _config?: AuthHandlerConfig,
): AuthHandlerInterface {
  // TODO: wrap user-provided auth function with config defaults
  throw new Error('Not implemented');
}
