/**
 * Wire protocol opcode enum for frame type identification.
 */
export enum Opcode {
  RPC_REQ = 0x01,
  RPC_RES = 0x02,
  EVENT_C2S = 0x03,
  EVENT_S2C = 0x04,
  STATE_PATCH = 0x05,
  STATE_SNAPSHOT = 0x06,
  PING = 0x07,
  PONG = 0x08,
  ERROR = 0x09,
  CRDT_OP = 0x0a,
  CRDT_STATE = 0x0b,
}

/** Set of valid opcode byte values for fast membership testing during decode. */
export const VALID_OPCODES: ReadonlySet<number> = new Set(
  Object.values(Opcode).filter((v): v is number => typeof v === 'number'),
);
