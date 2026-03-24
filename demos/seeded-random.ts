/**
 * Seeded pseudo-random number generator (Mulberry32) for deterministic demo output.
 * All demos use the same seed so e2e screenshots are stable across runs.
 */

const DEFAULT_SEED = 31183;

export interface SeededRandom {
  random(): number;
  int(min: number, max: number): number;
  uuid(): string;
  id(len?: number): string;
}

export function createSeededRandom(seed: number = DEFAULT_SEED): SeededRandom {
  let state = seed | 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function random(): number {
    return next();
  }

  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function uuid(): string {
    const hex = (n: number) =>
      Array.from({ length: n }, () =>
        Math.floor(next() * 16)
          .toString(16)
          .toLowerCase(),
      ).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(next() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
  }

  function id(len: number = 5): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: len }, () => chars[Math.floor(next() * chars.length)]).join('');
  }

  return { random, int, uuid, id };
}
