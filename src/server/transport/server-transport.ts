/**
 * Pure byte pipe: manages WebSocket connections, raw send/broadcast.
 * Pre-executor gate: rate limit check then dispatch compressed frame to executor.
 */
import type { Server as HttpServer } from 'http';

import { compress, decompress, deserialize, isCompressed, serialize } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import { decodeFrame, encodeFrame, Opcode } from '../../shared/protocol';
import type { ConnectionExecutor } from '../executor/types';
import type { MetricsCollector } from '../metrics';
import type { RateLimiter, RateLimitConfig, RateLimitRule } from '../primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from '../primitives/rate-limit/types';

import { Connection } from './connection';
import type { AuthHandler } from './upgrade-handler';
import { WsServer } from './ws-server';

export interface TransportOptions {
  path: string;
  perMessageDeflate?: boolean | undefined;
  maxConnections?: number;
  authHandler?: AuthHandler;
}

export class ServerTransport {
  private readonly connections = new Map<string, Connection>();
  private wsServer: WsServer | null = null;

  constructor(
    private readonly metrics: MetricsCollector,
    private readonly rateLimiter: RateLimiter,
    private readonly rateLimitConfig: RateLimitConfig,
  ) {}

  attach(server: HttpServer, opts: TransportOptions, executor: ConnectionExecutor): void {
    const maxConnections = opts.maxConnections ?? 10_000;
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

      executor.addConnection(info.id, {
        remoteAddress: info.remoteAddress,
        auth,
      });

      // For AsyncExecutor, attach the Connection object
      if ('setConnection' in executor) {
        (executor as { setConnection: (id: string, conn: Connection) => void }).setConnection(
          info.id,
          conn,
        );
      }

      conn.onMessage((data) => {
        void this.handleIncoming(conn, data, executor);
      });

      conn.onClose(() => {
        this.connections.delete(info.id);
        this.metrics.decrement('connections');
        executor.removeConnection(info.id);
      });
    });

    void this.wsServer.start(
      opts.perMessageDeflate === undefined
        ? { server, path: opts.path }
        : { server, path: opts.path, perMessageDeflate: opts.perMessageDeflate },
    );
  }

  private async handleIncoming(
    conn: Connection,
    raw: Uint8Array,
    executor: ConnectionExecutor,
  ): Promise<void> {
    try {
      this.metrics.increment('messagesIn');

      const rule = this.getRateLimitRule(raw);
      const key = this.getRateLimitKey(conn.info.id, raw);
      const result = await this.rateLimiter.consume(key, rule);
      if (!result.allowed) {
        let correlationId = 0;
        try {
          const data = isCompressed(raw) ? decompress(raw) : raw;
          const frame = decodeFrame(data);
          correlationId = frame.correlationId;
        } catch {
          // Can't decode — use default correlationId
        }
        const payload = serialize({
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        });
        let frameData = encodeFrame({ opcode: Opcode.ERROR, correlationId, payload });
        if (frameData.length > COMPRESSION_THRESHOLD) {
          frameData = compress(frameData);
        }
        void conn.send(frameData).catch(() => {});
        this.metrics.increment('messagesOut');
        return;
      }

      executor.dispatch(conn.info.id, raw);
    } catch {
      // Malformed or rate limited — ignore
    }
  }

  private getRateLimitKey(connectionId: string, raw: Uint8Array): string {
    if (this.rateLimitConfig.keyExtractor) {
      let method: string | undefined;
      try {
        const data = isCompressed(raw) ? decompress(raw) : raw;
        const frame = decodeFrame(data);
        if (frame.opcode === Opcode.RPC_REQ) {
          const req = deserialize<{ method?: string }>(frame.payload);
          method = req.method;
        }
      } catch {
        // Ignore decode errors for rate limit key
      }
      return this.rateLimitConfig.keyExtractor(connectionId, method);
    }
    return `${connectionId}:frame`;
  }

  private getRateLimitRule(raw: Uint8Array): RateLimitRule {
    if (this.rateLimitConfig.rules) {
      try {
        const data = isCompressed(raw) ? decompress(raw) : raw;
        const frame = decodeFrame(data);
        if (frame.opcode === Opcode.RPC_REQ) {
          const req = deserialize<{ method?: string }>(frame.payload);
          if (req.method && this.rateLimitConfig.rules[req.method]) {
            return this.rateLimitConfig.rules[req.method]!;
          }
        }
      } catch {
        // Ignore decode errors
      }
    }
    return this.rateLimitConfig.defaultRule ?? DEFAULT_RATE_LIMIT_RULE;
  }

  sendRaw(connectionId: string, data: Uint8Array): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      void conn.send(data).catch(() => {});
      this.metrics.increment('messagesOut');
    }
  }

  broadcastRaw(data: Uint8Array): void {
    for (const conn of this.connections.values()) {
      void conn.send(data).catch(() => {});
    }
    this.metrics.increment('messagesOut');
  }

  getConnections(): ReadonlyMap<string, Connection> {
    return this.connections;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  async close(): Promise<void> {
    if (this.wsServer) {
      await this.wsServer.stop();
      this.wsServer = null;
    }
    this.connections.clear();
  }
}
