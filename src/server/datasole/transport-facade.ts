/**
 * HTTP/WebSocket attachment and connection metrics for {@link DatasoleServer}.
 */
import type { Server as HttpServer } from 'http';

import type { DatasoleContract } from '../../shared/contract';
import type { ServerAdapter } from '../adapters/types';
import type { ConnectionExecutor } from '../executor/types';
import type { AuthHandlerFn } from '../primitives/auth/auth-handler';
import type { DatasoleServer } from '../server';
import type { ServerTransport } from '../transport/server-transport';

export interface DatasoleTransportAttachOptions {
  transport: ServerTransport;
  executor: ConnectionExecutor;
  path: string;
  perMessageDeflate: boolean | undefined;
  maxConnections: number;
  authHandler: AuthHandlerFn;
}

export class DatasoleServerTransportFacade<T extends DatasoleContract> {
  constructor(
    readonly server: DatasoleServer<T>,
    private readonly opts: DatasoleTransportAttachOptions,
  ) {}

  /** Attach datasole transport + runtime asset serving to an HTTP server. */
  attach(httpServer: HttpServer, _adapter?: ServerAdapter): void {
    this.opts.transport.attach(
      httpServer,
      {
        path: this.opts.path,
        perMessageDeflate: this.opts.perMessageDeflate,
        maxConnections: this.opts.maxConnections,
        authHandler: this.opts.authHandler,
      },
      this.opts.executor,
    );
  }

  /** Currently connected WebSocket client count. */
  getConnectionCount(): number {
    return this.opts.transport.getConnectionCount();
  }
}
