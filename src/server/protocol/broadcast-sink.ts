/**
 * Wire-protocol-agnostic broadcast interface consumed by application services.
 * Implemented by {@link ProtocolBroadcastSink} which encodes datasole wire frames.
 */
import type { CrdtState } from '../../shared/crdt';
import type { StatePatch } from '../../shared/types';

export interface BroadcastSink {
  broadcastStatePatch(key: string, patches: StatePatch[]): void;
  broadcastEvent(event: string, data: unknown): void;
  broadcastCrdtState(key: string, state: CrdtState): void;
}
