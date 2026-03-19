import { describe, it, expect } from 'vitest';

import {
  decodeFrame,
  encodeFrame,
  FRAME_HEADER_SIZE,
  Opcode,
} from '../../../../src/shared/protocol';

function roundTrip(frame: { opcode: Opcode; correlationId: number; payload: Uint8Array }): void {
  const encoded = encodeFrame(frame);
  const decoded = decodeFrame(encoded);
  expect(decoded.opcode).toBe(frame.opcode);
  expect(decoded.correlationId).toBe(frame.correlationId);
  expect(decoded.payload).toEqual(frame.payload);
}

describe('frames', () => {
  it('encode/decode round-trip for representative frame', () => {
    roundTrip({
      opcode: Opcode.RPC_REQ,
      correlationId: 0xdeadbeef,
      payload: new Uint8Array([1, 2, 3, 4]),
    });
  });

  it('empty payload round-trip', () => {
    roundTrip({
      opcode: Opcode.PING,
      correlationId: 0,
      payload: new Uint8Array(0),
    });
  });

  it('large payload round-trip', () => {
    const payload = new Uint8Array(200_000);
    for (let i = 0; i < payload.length; i++) payload[i] = i % 256;
    roundTrip({
      opcode: Opcode.STATE_SNAPSHOT,
      correlationId: 42,
      payload,
    });
  });

  it('throws when data is shorter than header', () => {
    expect(() => decodeFrame(new Uint8Array(FRAME_HEADER_SIZE - 1))).toThrow(/too short/);
    expect(() => decodeFrame(new Uint8Array(0))).toThrow(/too short/);
  });

  it('throws when payload length exceeds buffer (truncated)', () => {
    const buf = new Uint8Array(FRAME_HEADER_SIZE + 2);
    buf[0] = Opcode.PONG;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setUint32(1, 7, false);
    view.setUint32(5, 100, false);
    expect(() => decodeFrame(buf)).toThrow(/truncated/);
  });

  it('preserves each opcode value through encode/decode', () => {
    const opcodes = [
      Opcode.RPC_REQ,
      Opcode.RPC_RES,
      Opcode.EVENT_C2S,
      Opcode.EVENT_S2C,
      Opcode.STATE_PATCH,
      Opcode.STATE_SNAPSHOT,
      Opcode.PING,
      Opcode.PONG,
      Opcode.ERROR,
    ];
    for (const opcode of opcodes) {
      roundTrip({ opcode, correlationId: opcode * 0x1000, payload: new Uint8Array([opcode]) });
    }
  });
});
