/**
 * Binary frame encoding and decoding for the wire protocol.
 */
import { type Opcode, VALID_OPCODES } from './opcodes';

export const FRAME_HEADER_SIZE = 9;

/**
 * Maximum allowed payload per frame (1 MB). Prevents allocation of
 * attacker-controlled buffer sizes parsed from the 4-byte length field.
 */
export const MAX_FRAME_PAYLOAD = 1024 * 1024;

export interface Frame {
  opcode: Opcode;
  correlationId: number;
  payload: Uint8Array;
}

export function encodeFrame(frame: Frame): Uint8Array {
  if (frame.payload.length > MAX_FRAME_PAYLOAD) {
    throw new Error(`Payload too large: ${frame.payload.length} bytes (max ${MAX_FRAME_PAYLOAD})`);
  }
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
  const opcodeRaw = view.getUint8(0);
  if (!VALID_OPCODES.has(opcodeRaw)) {
    throw new Error(`Unknown opcode: 0x${opcodeRaw.toString(16).padStart(2, '0')}`);
  }
  const opcode = opcodeRaw as Opcode;
  const correlationId = view.getUint32(1, false);
  const payloadLength = view.getUint32(5, false);

  if (payloadLength > MAX_FRAME_PAYLOAD) {
    throw new Error(`Payload length ${payloadLength} exceeds max ${MAX_FRAME_PAYLOAD}`);
  }

  if (data.length < FRAME_HEADER_SIZE + payloadLength) {
    throw new Error(
      `Frame truncated: expected ${FRAME_HEADER_SIZE + payloadLength} bytes, got ${data.length}`,
    );
  }

  const payload = data.slice(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLength);

  return { opcode, correlationId, payload };
}
