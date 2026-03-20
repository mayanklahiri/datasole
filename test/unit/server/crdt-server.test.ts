import { describe, it, expect } from 'vitest';

import { PNCounter, LWWRegister, LWWMap } from '../../../src/shared/crdt';

describe('Server CRDT handling', () => {
  it('PNCounter: apply increment op and get state', () => {
    const counter = new PNCounter('server');
    counter.apply({
      type: 'pn-counter',
      nodeId: 'client-1',
      timestamp: Date.now(),
      op: 'increment',
      value: 5,
    });
    expect(counter.value()).toBe(5);
    const state = counter.state();
    expect(state.type).toBe('pn-counter');
    expect(state.value).toBe(5);
  });

  it('PNCounter: merge from multiple nodes', () => {
    const server = new PNCounter('server');
    server.apply({
      type: 'pn-counter',
      nodeId: 'a',
      timestamp: Date.now(),
      op: 'increment',
      value: 3,
    });
    server.apply({
      type: 'pn-counter',
      nodeId: 'b',
      timestamp: Date.now(),
      op: 'increment',
      value: 2,
    });
    server.apply({
      type: 'pn-counter',
      nodeId: 'a',
      timestamp: Date.now(),
      op: 'decrement',
      value: 1,
    });
    expect(server.value()).toBe(4);
  });

  it('LWWRegister: apply set op', () => {
    const reg = new LWWRegister<string | null>('server', null);
    const ts = Date.now();
    reg.apply({
      type: 'lww-register',
      nodeId: 'client-1',
      timestamp: ts,
      op: 'set',
      value: 'hello',
    });
    expect(reg.value()).toBe('hello');
  });

  it('LWWRegister: later timestamp wins', () => {
    const reg = new LWWRegister<string | null>('server', null, 0);
    reg.apply({ type: 'lww-register', nodeId: 'a', timestamp: 100, op: 'set', value: 'first' });
    reg.apply({ type: 'lww-register', nodeId: 'b', timestamp: 200, op: 'set', value: 'second' });
    reg.apply({ type: 'lww-register', nodeId: 'c', timestamp: 50, op: 'set', value: 'old' });
    expect(reg.value()).toBe('second');
  });

  it('LWWMap: apply set and remove', () => {
    const map = new LWWMap('server');
    const ts = Date.now();
    map.apply({ type: 'lww-map', nodeId: 'a', timestamp: ts, op: 'set', key: 'x', value: 1 });
    map.apply({ type: 'lww-map', nodeId: 'a', timestamp: ts + 1, op: 'set', key: 'y', value: 2 });
    expect(map.value()).toEqual({ x: 1, y: 2 });
    map.apply({ type: 'lww-map', nodeId: 'a', timestamp: ts + 2, op: 'remove', key: 'x' });
    expect(map.value()).toEqual({ y: 2 });
  });
});
