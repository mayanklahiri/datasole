/**
 * WebSocket server layer: HTTP upgrade wiring, connection lifecycle, and binary frame dispatch to handlers.
 */
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

import { WebSocketServer, WebSocket } from 'ws';

import type { AuthResult } from '../../shared/types';

import type { AuthHandler } from './upgrade-handler';

export interface WsServerOptions {
  server: HttpServer;
  path: string;
  perMessageDeflate?: boolean;
}

type ConnectionHandler = (
  ws: WebSocket,
  info: { id: string; remoteAddress: string; auth: AuthResult },
) => void;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private connectionCounter = 0;
  private connectionHandler: ConnectionHandler | null = null;
  private authHandler: AuthHandler = async () => ({ authenticated: true });

  onConnection(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
  }

  setAuthHandler(handler: AuthHandler): void {
    this.authHandler = handler;
  }

  async start(options: WsServerOptions): Promise<void> {
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: options.perMessageDeflate,
    });

    options.server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        .pathname;
      if (pathname !== options.path) {
        socket.destroy();
        return;
      }

      void this.handleUpgrade(req, socket, head);
    });
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      client.close(1001, 'Server shutting down');
    }
    await new Promise<void>((resolve) => {
      this.wss!.close(() => resolve());
    });
    this.wss = null;
  }

  getClientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  private async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const authResult = await this.authHandler(req);
      if (!authResult.authenticated) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        const id = `conn-${++this.connectionCounter}`;
        const remoteAddress = req.socket.remoteAddress ?? 'unknown';
        this.connectionHandler?.(ws, { id, remoteAddress, auth: authResult });
      });
    } catch {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }
}
