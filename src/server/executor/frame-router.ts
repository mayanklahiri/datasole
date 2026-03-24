/**
 * Opcode-based frame dispatch inside the executor context.
 * Decompresses, decodes, and routes frames to registered handlers.
 */
import { decompress, isCompressed } from '../../shared/codec';
import { decodeFrame, type Opcode } from '../../shared/protocol';
import type { Connection } from '../transport/connection';

export interface DecodedFrame {
  opcode: Opcode;
  correlationId: number;
  payload: Uint8Array;
}

export type FrameHandlerFn = (conn: Connection, frame: DecodedFrame) => Promise<void>;

export class FrameRouter {
  private handlers = new Map<Opcode, FrameHandlerFn>();

  register(opcode: Opcode, handler: FrameHandlerFn): void {
    this.handlers.set(opcode, handler);
  }

  async dispatch(conn: Connection, raw: Uint8Array): Promise<void> {
    const data = isCompressed(raw) ? decompress(raw) : raw;
    const frame = decodeFrame(data);
    const decoded: DecodedFrame = {
      opcode: frame.opcode,
      correlationId: frame.correlationId,
      payload: frame.payload,
    };

    const handler = this.handlers.get(frame.opcode);
    if (handler) {
      await handler(conn, decoded);
    }
  }
}
