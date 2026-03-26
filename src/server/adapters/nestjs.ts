/**
 * NestJS WebSocketAdapter integration for Datasole.
 */
import type { Server as HttpServer } from 'http';

import { BaseUpgradeAdapter } from './base-adapter';

export class DatasoleNestAdapter extends BaseUpgradeAdapter {
  private closeCallbacks = new Set<() => void>();

  override detach(): void {
    for (const cb of this.closeCallbacks) cb();
    this.closeCallbacks.clear();
    super.detach();
  }

  create(_port: number, _options?: unknown): HttpServer | null {
    return this.server;
  }

  bindClientConnect(_server: unknown, callback: (...args: unknown[]) => unknown): void {
    if (this.server) {
      this.server.on('connection', callback);
    }
  }

  bindClientDisconnect(client: unknown, callback: (...args: unknown[]) => unknown): void {
    const socket = client as { on?: (event: string, fn: () => void) => void };
    socket.on?.('close', callback as () => void);
  }

  bindMessageHandlers(
    _client: unknown,
    _handlers: unknown[],
    _process: (...args: unknown[]) => unknown,
  ): void {
    // Message routing is handled by DatasoleServer's frame dispatcher
  }

  close(_server: unknown): void {
    this.detach();
  }
}
