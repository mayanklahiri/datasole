/**
 * Routes decoded frames by opcode to the appropriate handler callbacks.
 */

import type { Frame } from '../../shared/protocol';
import { Opcode } from '../../shared/protocol';

export type FrameRouter = {
  onRpcResponse?: (correlationId: number, payload: unknown) => void;
  onEvent?: (event: string, data: unknown, timestamp: number) => void;
  onStatePatch?: (key: string, patches: unknown[]) => void;
  onStateSnapshot?: (key: string, data: unknown) => void;
  onPong?: (correlationId: number) => void;
  onError?: (message: string) => void;
  onCrdtOp?: (key: string, op: unknown) => void;
  onCrdtState?: (key: string, state: unknown) => void;
};

export function dispatchFrame(frame: Frame, router: FrameRouter): void {
  let parsed: Record<string, unknown>;
  try {
    const decoder = new TextDecoder();
    parsed = JSON.parse(decoder.decode(frame.payload)) as Record<string, unknown>;
  } catch {
    return;
  }

  switch (frame.opcode) {
    case Opcode.RPC_RES:
      router.onRpcResponse?.(frame.correlationId, parsed);
      break;
    case Opcode.EVENT_S2C:
      router.onEvent?.(parsed.event as string, parsed.data, parsed.timestamp as number);
      break;
    case Opcode.STATE_PATCH:
      router.onStatePatch?.(parsed.key as string, parsed.patches as unknown[]);
      break;
    case Opcode.STATE_SNAPSHOT:
      router.onStateSnapshot?.(parsed.key as string, parsed.data);
      break;
    case Opcode.PONG:
      router.onPong?.(frame.correlationId);
      break;
    case Opcode.ERROR:
      router.onError?.(parsed.message as string);
      break;
    case Opcode.CRDT_OP:
      router.onCrdtOp?.(parsed.key as string, parsed.op);
      break;
    case Opcode.CRDT_STATE:
      router.onCrdtState?.(parsed.key as string, parsed.state);
      break;
  }
}
