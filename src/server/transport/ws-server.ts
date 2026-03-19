import type { Server as HttpServer } from 'http';

export interface WsServerOptions {
  server: HttpServer;
  path: string;
  perMessageDeflate?: boolean;
}

export class WsServer {
  // TODO: wrap ws.WebSocketServer with binary frame mode
  async start(_options: WsServerOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented');
  }
}
