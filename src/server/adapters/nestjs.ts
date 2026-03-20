/**
 * NestJS WebSocketAdapter integration for Datasole.
 */
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

import type { ServerAdapter } from './types';

export class DatasoleNestAdapter implements ServerAdapter {
  private server: HttpServer | null = null;
  private upgradeListener: ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | null =
    null;
  private closeCallbacks = new Set<() => void>();

  attach(server: HttpServer): void {
    this.server = server;
  }

  onUpgrade(handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void {
    if (!this.server) throw new Error('DatasoleNestAdapter not attached to a server');
    this.upgradeListener = handler;
    this.server.on('upgrade', this.upgradeListener);
  }

  detach(): void {
    if (this.server && this.upgradeListener) {
      this.server.removeListener('upgrade', this.upgradeListener);
    }
    for (const cb of this.closeCallbacks) cb();
    this.closeCallbacks.clear();
    this.server = null;
    this.upgradeListener = null;
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
