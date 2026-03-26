/**
 * Registers datasole wire-protocol opcode handlers on a {@link FrameRouter},
 * mapping incoming frames to service calls (RPC, events, CRDT) and encoding responses.
 */
import { compress, deserialize, serialize } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import type { DatasoleContract } from '../../shared/contract';
import type { CrdtOperation } from '../../shared/crdt';
import { encodeFrame, Opcode } from '../../shared/protocol';
import type { RpcRequest } from '../../shared/types';
import type { MetricsCollector } from '../metrics';
import type { CrdtManager } from '../primitives/crdt/crdt-manager';
import type { EventBus } from '../primitives/events/event-bus';
import type { RpcContext, RpcDispatcher } from '../primitives/rpc/rpc-dispatcher';
import type { Connection } from '../transport/connection';

import type { BroadcastSink } from './broadcast-sink';
import type { FrameRouter } from './frame-router';

export interface ProtocolAdapterDeps<T extends DatasoleContract> {
  rpc: RpcDispatcher<T>;
  events: EventBus<T>;
  crdt: CrdtManager;
  metrics: MetricsCollector;
  maxEventNameLength: number;
  broadcastSink: BroadcastSink;
}

export function registerProtocolHandlers<T extends DatasoleContract>(
  router: FrameRouter,
  deps: ProtocolAdapterDeps<T>,
): void {
  router.register(Opcode.RPC_REQ, async (conn, frame) => {
    deps.metrics.increment('rpcCalls');
    const request = deserialize<RpcRequest>(frame.payload);
    const ctx: RpcContext = {
      auth: conn.info.auth,
      connectionId: conn.info.id,
      connection: conn.context,
    };
    const response = await deps.rpc.dispatch(request, ctx);
    if (response.error) {
      deps.metrics.increment('rpcErrors');
    }
    sendToConnection(conn, Opcode.RPC_RES, frame.correlationId, response, deps.metrics);
  });

  router.register(Opcode.EVENT_C2S, async (_conn, frame) => {
    const payload = deserialize<{ event: string; data: unknown }>(frame.payload);
    if (
      typeof payload.event !== 'string' ||
      payload.event.length === 0 ||
      payload.event.length > deps.maxEventNameLength
    ) {
      return;
    }
    deps.events.emit(payload.event as keyof T['events'] & string, payload.data as never);
  });

  router.register(Opcode.PING, async (conn, frame) => {
    sendToConnection(conn, Opcode.PONG, frame.correlationId, null, deps.metrics);
  });

  router.register(Opcode.CRDT_OP, async (conn, frame) => {
    const payload = deserialize<{ key: string; op: CrdtOperation }>(frame.payload);
    const result = deps.crdt.apply(conn.info.id, { ...payload.op, key: payload.key });
    if (result) {
      deps.broadcastSink.broadcastCrdtState(result.key, result.state);
    }
  });
}

function sendToConnection(
  conn: Connection,
  opcode: Opcode,
  correlationId: number,
  data: unknown,
  metrics: MetricsCollector,
): void {
  try {
    const payload = serialize(data ?? null);
    let frameData = encodeFrame({ opcode, correlationId, payload });
    if (frameData.length > COMPRESSION_THRESHOLD) {
      frameData = compress(frameData);
    }
    void conn.send(frameData).catch(() => {});
    metrics.increment('messagesOut');
  } catch {
    // Send failure — connection may be closing
  }
}
