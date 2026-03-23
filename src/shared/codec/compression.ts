/**
 * pako-based compression and decompression for frame payloads.
 *
 * Detection: zlib streams always start with 0x78 (CMF byte: deflate + 32KB window).
 * Frame opcodes are 0x01–0x0B, so the first byte reliably distinguishes
 * compressed from raw wire data without a protocol-level flag.
 */
import pako from 'pako';

const ZLIB_MAGIC = 0x78;

export function compress(data: Uint8Array): Uint8Array {
  return pako.deflate(data);
}

export function decompress(data: Uint8Array): Uint8Array {
  return pako.inflate(data);
}

export function isCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === ZLIB_MAGIC;
}
