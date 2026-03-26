/**
 * Shared upgrade-wiring base for HTTP server adapters.
 */
import type { Server as HttpServer } from 'http';

import type { ServerAdapter, UpgradeHandler } from './types';

export class BaseUpgradeAdapter implements ServerAdapter {
  protected server: HttpServer | null = null;
  protected upgradeListener: UpgradeHandler | null = null;

  attach(server: HttpServer): void {
    this.server = server;
  }

  onUpgrade(handler: UpgradeHandler): void {
    if (!this.server) throw new Error(`${this.constructor.name} not attached to a server`);
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
