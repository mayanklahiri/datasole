import { Opcode } from './opcodes';

export interface Frame {
  opcode: Opcode;
  correlationId: number;
  payload: Uint8Array;
}

export function encodeFrame(_frame: Frame): Uint8Array {
  // TODO: implement binary frame encoding (DataView-based)
  throw new Error('Not implemented');
}

export function decodeFrame(_data: Uint8Array): Frame {
  // TODO: implement binary frame decoding
  throw new Error('Not implemented');
}
