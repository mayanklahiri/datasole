/**
 * Auth handler: default is a pass-through that assigns connectionId + remoteAddress.
 */
import type { IncomingMessage } from 'http';

import type { AuthHandlerFn } from '../../contracts';

export type { AuthHandlerFn };

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
