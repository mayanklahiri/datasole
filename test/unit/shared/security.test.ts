/**
 * Security-focused tests for protocol hardening, input validation, and DoS resistance.
 */
import { describe, it, expect } from 'vitest';

import { compress, decompress } from '../../../src/shared/codec/compression';
import { LWWMap } from '../../../src/shared/crdt/lww-map';
import { LWWRegister } from '../../../src/shared/crdt/lww-register';
import { PNCounter } from '../../../src/shared/crdt/pn-counter';
import { applyPatch } from '../../../src/shared/diff/json-patch';
import {
  decodeFrame,
  encodeFrame,
  FRAME_HEADER_SIZE,
  MAX_FRAME_PAYLOAD,
  Opcode,
} from '../../../src/shared/protocol';

describe('Frame security', () => {
  it('rejects unknown opcodes', () => {
    const buf = new Uint8Array(FRAME_HEADER_SIZE);
    buf[0] = 0xff;
    expect(() => decodeFrame(buf)).toThrow(/Unknown opcode/);
  });

  it('rejects opcode 0x00', () => {
    const buf = new Uint8Array(FRAME_HEADER_SIZE);
    buf[0] = 0x00;
    expect(() => decodeFrame(buf)).toThrow(/Unknown opcode/);
  });

  it('rejects payload length exceeding MAX_FRAME_PAYLOAD', () => {
    const buf = new Uint8Array(FRAME_HEADER_SIZE);
    buf[0] = Opcode.PING;
    const view = new DataView(buf.buffer);
    view.setUint32(5, MAX_FRAME_PAYLOAD + 1, false);
    expect(() => decodeFrame(buf)).toThrow(/exceeds max/);
  });

  it('encodeFrame rejects payload exceeding MAX_FRAME_PAYLOAD', () => {
    const huge = new Uint8Array(MAX_FRAME_PAYLOAD + 1);
    expect(() => encodeFrame({ opcode: Opcode.PING, correlationId: 0, payload: huge })).toThrow(
      /too large/,
    );
  });

  it('rejects single-byte input', () => {
    expect(() => decodeFrame(new Uint8Array(1))).toThrow(/too short/);
  });

  it('rejects zero-byte input', () => {
    expect(() => decodeFrame(new Uint8Array(0))).toThrow(/too short/);
  });
});

describe('Compression bomb protection', () => {
  it('rejects decompression output exceeding MAX_DECOMPRESSED_SIZE', () => {
    // 20 MB of zeros compresses to a tiny blob but decompresses to >16 MB
    const huge = new Uint8Array(20 * 1024 * 1024);
    const compressed = compress(huge);
    expect(compressed.length).toBeLessThan(100_000);
    expect(() => decompress(compressed)).toThrow(/too large/);
  });

  it('rejects oversized compressed input', () => {
    // Craft a fake >4 MB compressed input
    const tooBig = new Uint8Array(5 * 1024 * 1024);
    tooBig[0] = 0x78;
    expect(() => decompress(tooBig)).toThrow(/too large/);
  });

  it('normal-sized data still decompresses fine', () => {
    const data = new Uint8Array(10_000);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;
    expect(decompress(compress(data))).toEqual(data);
  });
});

describe('JSON Patch prototype pollution protection', () => {
  it('rejects __proto__ in path', () => {
    expect(() => applyPatch({}, [{ op: 'add', path: '/__proto__/polluted', value: true }])).toThrow(
      /Forbidden path/,
    );
  });

  it('rejects constructor in path', () => {
    expect(() =>
      applyPatch({}, [{ op: 'add', path: '/constructor/prototype/x', value: 1 }]),
    ).toThrow(/Forbidden path/);
  });

  it('rejects prototype in path', () => {
    expect(() => applyPatch({}, [{ op: 'replace', path: '/prototype', value: {} }])).toThrow(
      /Forbidden path/,
    );
  });

  it('legitimate patches still work', () => {
    const result = applyPatch({ a: 1 }, [
      { op: 'add', path: '/b', value: 2 },
      { op: 'replace', path: '/a', value: 99 },
    ]);
    expect(result).toEqual({ a: 99, b: 2 });
  });
});

describe('LWWMap security', () => {
  it('value() returns null-prototype object (no __proto__ leakage)', () => {
    const map = new LWWMap<string>('n');
    map.set('x', 'y');
    const v = map.value();
    expect(Object.getPrototypeOf(v)).toBeNull();
  });

  it('merge skips __proto__ keys', () => {
    const map = new LWWMap<string>('n');
    map.merge({
      type: 'lww-map',
      value: { safe: 'ok', __proto__: 'evil', constructor: 'bad' } as Record<string, string>,
      metadata: { type: 'lww-map', nodeId: 'b', timestamp: 1000, version: 1 },
    });
    expect(map.get('safe')).toBe('ok');
    expect(map.get('__proto__')).toBeUndefined();
    expect(map.get('constructor')).toBeUndefined();
  });

  it('merge rejects missing metadata', () => {
    const map = new LWWMap<string>('n');
    map.merge({ type: 'lww-map', value: { x: 'y' }, metadata: null as never });
    expect(map.get('x')).toBeUndefined();
  });

  it('merge rejects oversized value object', () => {
    const map = new LWWMap<number>('n');
    const huge: Record<string, number> = {};
    for (let i = 0; i < 10_001; i++) huge[`k${i}`] = i;
    expect(() =>
      map.merge({
        type: 'lww-map',
        value: huge,
        metadata: { type: 'lww-map', nodeId: 'b', timestamp: 1000, version: 1 },
      }),
    ).toThrow(/too large/);
  });
});

describe('LWWRegister security', () => {
  it('merge with invalid metadata is no-op', () => {
    const reg = new LWWRegister<number>('n', 42, 1000);
    reg.merge({ type: 'lww-register', value: 99, metadata: {} as never });
    expect(reg.value()).toBe(42);
  });

  it('merge with null remote is no-op', () => {
    const reg = new LWWRegister<number>('n', 42, 1000);
    reg.merge(null as never);
    expect(reg.value()).toBe(42);
  });
});

describe('PNCounter security', () => {
  it('merge skips non-numeric count values', () => {
    const counter = new PNCounter('n');
    counter.increment(5);
    counter.merge({
      type: 'pn-counter',
      value: 0,
      metadata: {
        type: 'pn-counter',
        nodeId: 'evil',
        timestamp: 1000,
        version: 1,
        vector: {
          increments: { evil: 'NaN-attack' as unknown as number, n: 3 },
          decrements: { evil: undefined as unknown as number },
        },
      } as never,
    });
    expect(counter.value()).toBe(5);
  });

  it('merge with null metadata is no-op', () => {
    const counter = new PNCounter('n');
    counter.increment(3);
    counter.merge({ type: 'pn-counter', value: 0, metadata: null as never });
    expect(counter.value()).toBe(3);
  });
});
