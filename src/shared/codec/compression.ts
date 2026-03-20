/**
 * pako-based compression and decompression for frame payloads.
 */
import pako from 'pako';

export function compress(data: Uint8Array): Uint8Array {
  return pako.deflate(data);
}

export function decompress(data: Uint8Array): Uint8Array {
  return pako.inflate(data);
}
