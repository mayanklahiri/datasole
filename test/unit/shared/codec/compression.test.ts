import { describe, it, expect } from 'vitest';

import { compress, decompress } from '../../../../src/shared/codec/compression';

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
