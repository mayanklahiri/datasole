/**
 * JSON serialization and deserialization via TextEncoder and TextDecoder.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function serialize(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

export function deserialize<T = unknown>(data: Uint8Array): T {
  return JSON.parse(decoder.decode(data)) as T;
}
