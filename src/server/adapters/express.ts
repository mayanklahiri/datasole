/**
 * ServerAdapter implementation for Express HTTP servers.
 */
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

import type { ServerAdapter } from './types';

export class ExpressAdapter implements ServerAdapter {
  private server: HttpServer | null = null;
  private upgradeListener: ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | null =
    null;

  attach(server: HttpServer): void {
    this.server = server;
  }

  onUpgrade(handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void {
    if (!this.server) throw new Error('ExpressAdapter not attached to a server');
    this.upgradeListener = handler;
    this.server.on('upgrade', this.upgradeListener);
  }

  detach(): void {
    if (this.server && this.upgradeListener) {
      this.server.removeListener('upgrade', this.upgradeListener);
    }
    this.server = null;
    this.upgradeListener = null;
  }
}
