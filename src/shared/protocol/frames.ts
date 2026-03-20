/**
 * Binary frame encoding and decoding for the wire protocol.
 */
import { Opcode } from './opcodes';

export const FRAME_HEADER_SIZE = 9;

export interface Frame {
  opcode: Opcode;
  correlationId: number;
  payload: Uint8Array;
}

export function encodeFrame(frame: Frame): Uint8Array {
  const totalLength = FRAME_HEADER_SIZE + frame.payload.length;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, frame.opcode);
  view.setUint32(1, frame.correlationId, false);
  view.setUint32(5, frame.payload.length, false);
  bytes.set(frame.payload, FRAME_HEADER_SIZE);

  return bytes;
}

export function decodeFrame(data: Uint8Array): Frame {
  if (data.length < FRAME_HEADER_SIZE) {
    throw new Error(`Frame too short: ${data.length} bytes (minimum ${FRAME_HEADER_SIZE})`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const opcode = view.getUint8(0) as Opcode;
  const correlationId = view.getUint32(1, false);
  const payloadLength = view.getUint32(5, false);

  if (data.length < FRAME_HEADER_SIZE + payloadLength) {
    throw new Error(
      `Frame truncated: expected ${FRAME_HEADER_SIZE + payloadLength} bytes, got ${data.length}`,
    );
  }

  const payload = data.slice(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLength);

  return { opcode, correlationId, payload };
}
