/**
 * Thin facade over {@link ServerTransport}: exposes attach/close/count for the
 * public {@link DatasoleServer.transport} surface. No back-pointer to the server —
 * all wiring is done in the container constructor.
 */
import type { Server as HttpServer } from 'http';

import type { AuthHandlerFn } from '../contracts';
import type { ServerTransport, TransportLifecycle } from '../transport/server-transport';

export interface DatasoleTransportAttachOptions {
  transport: ServerTransport;
  lifecycle: TransportLifecycle;
  path: string;
  maxConnections: number;
  authHandler: AuthHandlerFn;
}

export class DatasoleServerTransportFacade {
  constructor(private readonly opts: DatasoleTransportAttachOptions) {}

  /** Attach datasole transport + runtime asset serving to an HTTP server. */
  attach(httpServer: HttpServer): void {
    this.opts.transport.attach(
      httpServer,
      {
        path: this.opts.path,
        perMessageDeflate: false,
        maxConnections: this.opts.maxConnections,
        authHandler: this.opts.authHandler,
      },
      this.opts.lifecycle,
    );
  }

  /** Currently connected WebSocket client count. */
  getConnectionCount(): number {
    return this.opts.transport.getConnectionCount();
  }

  /** @internal */
  async closeTransport(): Promise<void> {
    await this.opts.transport.close();
  }
}
