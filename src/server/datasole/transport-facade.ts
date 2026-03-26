/**
 * HTTP/WebSocket attachment, connection metrics, and inbound frame protocol wiring.
 */
import type { Server as HttpServer } from 'http';

import { compress, deserialize, serialize } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import type { DatasoleContract } from '../../shared/contract';
import type { CrdtOperation } from '../../shared/crdt';
import { encodeFrame, Opcode } from '../../shared/protocol';
import type { RpcRequest } from '../../shared/types';
import type { ServerAdapter } from '../adapters/types';
import { AsyncExecutor } from '../executor/async-executor';
import type { FrameRouter } from '../executor/frame-router';
import type { ConnectionExecutor } from '../executor/types';
import type { AuthHandlerFn } from '../primitives/auth/auth-handler';
import type { RpcContext } from '../primitives/rpc/rpc-dispatcher';
import type { DatasoleServer } from '../server';
import type { Connection } from '../transport/connection';
import type { ServerTransport } from '../transport/server-transport';

export interface DatasoleTransportAttachOptions {
  transport: ServerTransport;
  executor: ConnectionExecutor;
  path: string;
  maxConnections: number;
  authHandler: AuthHandlerFn;
  maxEventNameLength: number;
}

export class DatasoleServerTransportFacade<T extends DatasoleContract> {
  constructor(
    readonly server: DatasoleServer<T>,
    private readonly opts: DatasoleTransportAttachOptions,
  ) {
    this.wireFrameHandlers();
  }

  /** Attach datasole transport + runtime asset serving to an HTTP server. */
  attach(httpServer: HttpServer, _adapter?: ServerAdapter): void {
    this.opts.transport.attach(
      httpServer,
      {
        path: this.opts.path,
        perMessageDeflate: false,
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

  /**
   * Encode one logical protocol frame and broadcast it to all connections.
   * Used by {@link DatasoleServer.localServer} for state, events, and CRDT sync.
   */
  broadcastProtocolFrame(opcode: Opcode, data: unknown): void {
    const payload = serialize(data);
    let frameData = encodeFrame({ opcode, correlationId: 0, payload });
    if (frameData.length > COMPRESSION_THRESHOLD) {
      frameData = compress(frameData);
    }
    this.opts.transport.broadcastRaw(frameData);
  }

  /** @internal */
  async closeTransport(): Promise<void> {
    await this.opts.transport.close();
  }

  private getFrameRouter(): FrameRouter | null {
    if (this.opts.executor instanceof AsyncExecutor) {
      return this.opts.executor.router;
    }
    if ('router' in this.opts.executor) {
      return (this.opts.executor as { router: FrameRouter }).router;
    }
    return null;
  }

  private wireFrameHandlers(): void {
    const router = this.getFrameRouter();
    if (!router) return;

    router.register(Opcode.RPC_REQ, async (conn, frame) => {
      const request = deserialize<RpcRequest>(frame.payload);
      const ctx: RpcContext = {
        auth: conn.info.auth,
        connectionId: conn.info.id,
        connection: conn.context,
      };
      const response = await this.server.rpc.dispatch(request, ctx);
      this.sendToConnection(conn, Opcode.RPC_RES, frame.correlationId, response);
    });

    router.register(Opcode.EVENT_C2S, async (conn, frame) => {
      const payload = deserialize<{ event: string; data: unknown }>(frame.payload);
      if (
        typeof payload.event !== 'string' ||
        payload.event.length === 0 ||
        payload.event.length > this.opts.maxEventNameLength
      ) {
        return;
      }
      this.server.primitives.events.emit(
        payload.event as keyof T['events'] & string,
        payload.data as never,
      );
    });

    router.register(Opcode.PING, async (conn, frame) => {
      this.sendToConnection(conn, Opcode.PONG, frame.correlationId, null);
    });

    router.register(Opcode.CRDT_OP, async (conn, frame) => {
      const payload = deserialize<{ key: string; op: CrdtOperation }>(frame.payload);
      const result = this.server.primitives.crdt.apply(conn.info.id, {
        ...payload.op,
        key: payload.key,
      });
      if (result) {
        this.broadcastProtocolFrame(Opcode.CRDT_STATE, {
          key: result.key,
          state: result.state,
        });
      }
    });
  }

  private sendToConnection(
    conn: Connection,
    opcode: Opcode,
    correlationId: number,
    data: unknown,
  ): void {
    try {
      const payload = serialize(data ?? null);
      let frameData = encodeFrame({ opcode, correlationId, payload });
      if (frameData.length > COMPRESSION_THRESHOLD) {
        frameData = compress(frameData);
      }
      void conn.send(frameData).catch(() => {});
      this.server.metrics.increment('messagesOut');
    } catch {
      // Send failure — connection may be closing
    }
  }
}
