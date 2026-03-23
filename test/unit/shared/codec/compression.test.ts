import { describe, it, expect } from 'vitest';

import { compress, decompress, isCompressed } from '../../../../src/shared/codec/compression';

describe('compression', () => {
  it('compress/decompress round-trip', () => {
    const input = new TextEncoder().encode('hello datasole');
    const out = decompress(compress(input));
    expect(out).toEqual(input);
  });

  it('empty data round-trip', () => {
    const input = new Uint8Array(0);
    expect(decompress(compress(input))).toEqual(input);
  });

  it('large data round-trip', () => {
    const input = new Uint8Array(500_000);
    for (let i = 0; i < input.length; i++) input[i] = i % 251;
    expect(decompress(compress(input))).toEqual(input);
  });

  it('decompress of non-deflate data throws', () => {
    expect(() => decompress(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow();
  });
});

describe('isCompressed', () => {
  it('returns true for compressed data (zlib magic 0x78)', () => {
    const data = new TextEncoder().encode('test');
    expect(isCompressed(compress(data))).toBe(true);
  });

  it('returns false for raw frame data (opcode first byte)', () => {
    // Opcodes are 0x01–0x0B, never 0x78
    for (const opcode of [0x01, 0x02, 0x03, 0x0b]) {
      const raw = new Uint8Array([opcode, 0x00, 0x00, 0x00, 0x00]);
      expect(isCompressed(raw)).toBe(false);
    }
  });

  it('returns false for empty or too-short data', () => {
    expect(isCompressed(new Uint8Array(0))).toBe(false);
    expect(isCompressed(new Uint8Array(1))).toBe(false);
  });

  it('correctly round-trips highly compressible data that shrinks below threshold', () => {
    // 1000 bytes of zeros compresses to well under 256 bytes
    const original = new Uint8Array(1000);
    const compressed = compress(original);
    expect(compressed.length).toBeLessThan(256);
    expect(isCompressed(compressed)).toBe(true);
    expect(decompress(compressed)).toEqual(original);
  });
});
