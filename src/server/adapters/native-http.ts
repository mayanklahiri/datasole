/**
 * ServerAdapter implementation for Node.js native http.createServer() HTTP servers.
 */
import type { Server as HttpServer } from 'http';

import type { ServerAdapter } from './types';

export class NativeHttpAdapter implements ServerAdapter {
  attach(_server: HttpServer): void {
    // TODO: hook into Node http.Server upgrade event
  }

  detach(): void {
    // TODO: remove upgrade listener
  }
}
