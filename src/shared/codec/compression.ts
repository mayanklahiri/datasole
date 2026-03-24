/**
 * pako-based compression and decompression for frame payloads.
 *
 * Detection: zlib streams always start with 0x78 (CMF byte: deflate + 32KB window).
 * Frame opcodes are 0x01–0x0B, so the first byte reliably distinguishes
 * compressed from raw wire data without a protocol-level flag.
 */
import pako from 'pako';

const ZLIB_MAGIC = 0x78;

/**
 * Hard ceiling on decompressed output to prevent zip-bomb DoS.
 * 16 MB is generous for any realistic datasole frame.
 */
export const MAX_DECOMPRESSED_SIZE = 16 * 1024 * 1024;

/**
 * Hard ceiling on compressed input accepted by decompress().
 * Prevents feeding arbitrarily large blobs into inflate.
 */
export const MAX_COMPRESSED_INPUT = 4 * 1024 * 1024;

export function compress(data: Uint8Array): Uint8Array {
  return pako.deflate(data);
}

export function decompress(data: Uint8Array): Uint8Array {
  if (data.length > MAX_COMPRESSED_INPUT) {
    throw new Error(
      `Compressed input too large: ${data.length} bytes (max ${MAX_COMPRESSED_INPUT})`,
    );
  }
  const result = pako.inflate(data);
  if (result.length > MAX_DECOMPRESSED_SIZE) {
    throw new Error(
      `Decompressed output too large: ${result.length} bytes (max ${MAX_DECOMPRESSED_SIZE})`,
    );
  }
  return result;
}

export function isCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === ZLIB_MAGIC;
}
