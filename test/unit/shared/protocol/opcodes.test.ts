import { describe, it, expect } from 'vitest';

import { Opcode } from '../../../../src/shared/protocol/opcodes';

describe('Opcode', () => {
  it('has CRDT_OP opcode', () => {
    expect(Opcode.CRDT_OP).toBe(0x0a);
  });
  it('has CRDT_STATE opcode', () => {
    expect(Opcode.CRDT_STATE).toBe(0x0b);
  });
  it('all opcodes are unique', () => {
    const values = Object.values(Opcode).filter((v) => typeof v === 'number');
    expect(new Set(values).size).toBe(values.length);
  });
});
