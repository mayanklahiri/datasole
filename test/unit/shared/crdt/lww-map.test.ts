import { describe, expect, it } from 'vitest';

import { LWWMap } from '../../../../src/shared/crdt/lww-map';

describe('LWWMap', () => {
  it('set and get', () => {
    const map = new LWWMap<number>('node-a');
    map.set('x', 10, 1000);
    map.set('y', 20, 1000);

    expect(map.get('x')).toBe(10);
    expect(map.get('y')).toBe(20);
    expect(map.get('z')).toBeUndefined();
  });

  it('value returns all entries', () => {
    const map = new LWWMap<string>('node-a');
    map.set('a', 'hello', 1000);
    map.set('b', 'world', 1000);

    expect(map.value()).toEqual({ a: 'hello', b: 'world' });
  });

  it('set returns a CrdtOperation', () => {
    const map = new LWWMap<number>('node-a');
    const op = map.set('k', 42, 5000);

    expect(op.type).toBe('lww-map');
    expect(op.nodeId).toBe('node-a');
    expect(op.op).toBe('set');
    expect(op.key).toBe('k');
    expect(op.value).toBe(42);
    expect(op.timestamp).toBe(5000);
  });

  it('delete marks a key as undefined', () => {
    const map = new LWWMap<string>('node-a');
    map.set('k', 'val', 1000);
    const op = map.delete('k', 2000);

    expect(map.get('k')).toBeUndefined();
    expect(op.op).toBe('remove');
    expect(op.key).toBe('k');
    expect(map.value()).toEqual({});
  });

  it('apply set operation', () => {
    const map = new LWWMap<number>('node-a');
    map.apply({
      type: 'lww-map',
      nodeId: 'node-b',
      timestamp: 1000,
      op: 'set',
      key: 'x',
      value: 99,
    });

    expect(map.get('x')).toBe(99);
  });

  it('apply remove operation', () => {
    const map = new LWWMap<number>('node-a');
    map.set('x', 10, 1000);
    map.apply({ type: 'lww-map', nodeId: 'node-b', timestamp: 2000, op: 'remove', key: 'x' });

    expect(map.get('x')).toBeUndefined();
  });

  it('merge with remote state', () => {
    const map = new LWWMap<string>('node-a');
    map.set('a', 'local', 1000);

    map.merge({
      type: 'lww-map',
      value: { a: 'remote', b: 'new' },
      metadata: { type: 'lww-map', nodeId: 'node-b', timestamp: 2000, version: 1 },
    });

    expect(map.get('a')).toBe('remote');
    expect(map.get('b')).toBe('new');
  });

  it('state returns current state', () => {
    const map = new LWWMap<number>('node-a');
    map.set('x', 1, 1000);
    map.set('y', 2, 1000);

    const s = map.state();
    expect(s.type).toBe('lww-map');
    expect(s.value).toEqual({ x: 1, y: 2 });
    expect(s.metadata.nodeId).toBe('node-a');
    expect(s.metadata.version).toBeGreaterThan(0);
  });
});
