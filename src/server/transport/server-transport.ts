/**
 * Pure byte pipe: manages WebSocket connections, raw send/broadcast, and static asset serving.
 * Frame processing (rate limiting, protocol dispatch) is handled by the {@link TransportLifecycle}
 * callbacks provided to {@link attach}.
 */
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';

import type { MetricsCollector } from '../metrics';

import { Connection } from './connection';
import { StaticAssetServer } from './static-assets';
import type { AuthHandler } from './upgrade-handler';
import { WsServer } from './ws-server';

/**
 * After we fully handle a static asset, framework `request` listeners may still
 * run; replace response mutators with no-ops so they cannot double-send.
 */
function silenceHttpResponseAfterStaticSend(res: ServerResponse): void {
  res.setHeader = function silencedSetHeader(
    this: ServerResponse,
    _name: string,
    _value: number | string | readonly string[],
  ): ServerResponse {
    return this;
  } as ServerResponse['setHeader'];

  res.writeHead = function silencedWriteHead(
    this: ServerResponse,
    ..._args: Parameters<ServerResponse['writeHead']>
  ): ServerResponse {
    return this;
  } as ServerResponse['writeHead'];

  res.end = function silencedEnd(
    this: ServerResponse,
    ..._args: Parameters<ServerResponse['end']>
  ): ServerResponse {
    return this;
  } as ServerResponse['end'];
}

export interface TransportOptions {
  path: string;
  perMessageDeflate?: boolean | undefined;
  maxConnections?: number;
  authHandler?: AuthHandler;
}

/** Callbacks invoked by the transport for connection lifecycle and frame delivery. */
export interface TransportLifecycle {
  onFrame(connectionId: string, raw: Uint8Array): Promise<void>;
  onConnect(connectionId: string, conn: Connection): void;
  onDisconnect(connectionId: string): void;
}

export class ServerTransport {
  private readonly connections = new Map<string, Connection>();
  private wsServer: WsServer | null = null;
  private server: HttpServer | null = null;
  private staticRequestHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

  constructor(private readonly metrics: MetricsCollector) {}

  attach(server: HttpServer, opts: TransportOptions, lifecycle: TransportLifecycle): void {
    this.server = server;
    const maxConnections = opts.maxConnections ?? 10_000;
    const staticAssets = new StaticAssetServer(opts.path);
    this.staticRequestHandler = (req, res) => {
      const handled = staticAssets.handleRequest(req, res);
      if (!handled) return;

      silenceHttpResponseAfterStaticSend(res);
    };
    server.prependListener('request', this.staticRequestHandler);

    this.wsServer = new WsServer();
    if (opts.authHandler) {
      this.wsServer.setAuthHandler(opts.authHandler);
    }

    this.wsServer.onConnection((ws, info) => {
      if (this.connections.size >= maxConnections) {
        ws.close(1013, 'Max connections reached');
        return;
      }

      const auth = info.auth.authenticated
        ? {
            userId: info.auth.userId ?? info.id,
            roles: info.auth.roles ?? [],
            metadata: info.auth.metadata ?? {},
          }
        : null;

      const conn = new Connection(
        {
          id: info.id,
          remoteAddress: info.remoteAddress,
          connectedAt: Date.now(),
          auth,
        },
        ws,
      );

      this.connections.set(info.id, conn);
      this.metrics.increment('connections');

      lifecycle.onConnect(info.id, conn);

      conn.onMessage((data) => {
        void lifecycle.onFrame(info.id, data).catch(() => {});
      });

      conn.onClose(() => {
        this.connections.delete(info.id);
        this.metrics.decrement('connections');
        lifecycle.onDisconnect(info.id);
      });
    });

    void this.wsServer.start(
      opts.perMessageDeflate === undefined
        ? { server, path: opts.path }
        : { server, path: opts.path, perMessageDeflate: opts.perMessageDeflate },
    );
  }

  sendRaw(connectionId: string, data: Uint8Array): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      void conn.send(data).catch(() => {});
      this.metrics.increment('messagesOut');
      this.metrics.increment('bytesOut', data.byteLength);
    }
  }

  broadcastRaw(data: Uint8Array): void {
    const count = this.connections.size;
    for (const conn of this.connections.values()) {
      void conn.send(data).catch(() => {});
    }
    this.metrics.increment('messagesOut');
    this.metrics.increment('bytesOut', data.byteLength * count);
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getConnections(): ReadonlyMap<string, Connection> {
    return this.connections;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  async close(): Promise<void> {
    if (this.server && this.staticRequestHandler) {
      this.server.off('request', this.staticRequestHandler);
      this.staticRequestHandler = null;
    }
    if (this.wsServer) {
      await this.wsServer.stop();
      this.wsServer = null;
    }
    this.server = null;
    this.connections.clear();
  }
}
