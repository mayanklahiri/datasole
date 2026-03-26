/**
 * {@link BroadcastSink} implementation that encodes datasole wire frames and
 * delegates to a raw byte broadcaster (typically {@link ServerTransport.broadcastRaw}).
 */
import { compress, serialize } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import type { CrdtState } from '../../shared/crdt';
import { encodeFrame, Opcode } from '../../shared/protocol';
import type { StatePatch } from '../../shared/types';
import type { MetricsCollector } from '../metrics';

import type { BroadcastSink } from './broadcast-sink';

export class ProtocolBroadcastSink implements BroadcastSink {
  constructor(
    private readonly broadcastRaw: (data: Uint8Array) => void,
    private readonly metrics?: MetricsCollector,
  ) {}

  broadcastStatePatch(key: string, patches: StatePatch[]): void {
    this.metrics?.increment('statePatches');
    this.broadcastEncoded(Opcode.STATE_PATCH, { key, patches });
  }

  broadcastEvent(event: string, data: unknown): void {
    this.broadcastEncoded(Opcode.EVENT_S2C, { event, data, timestamp: Date.now() });
  }

  broadcastCrdtState(key: string, state: CrdtState): void {
    this.broadcastEncoded(Opcode.CRDT_STATE, { key, state });
  }

  private broadcastEncoded(opcode: Opcode, data: unknown): void {
    const payload = serialize(data);
    let frameData = encodeFrame({ opcode, correlationId: 0, payload });
    if (frameData.length > COMPRESSION_THRESHOLD) {
      frameData = compress(frameData);
    }
    this.broadcastRaw(frameData);
  }
}
