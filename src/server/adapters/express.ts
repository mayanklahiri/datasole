/**
 * ServerAdapter implementation for Express HTTP servers.
 */
import type { Server as HttpServer } from 'http';

import type { ServerAdapter } from './types';

export class ExpressAdapter implements ServerAdapter {
  attach(_server: HttpServer): void {
    // TODO: hook into Express server's upgrade event
  }

  detach(): void {
    // TODO: remove upgrade listener
  }
}
