import { describe, expect, it } from 'vitest';

import { CrdtStore } from '../../../src/client/crdt/crdt-store';
import type { LWWMap, LWWRegister, PNCounter } from '../../../src/shared/crdt';

describe('CrdtStore', () => {
  it('registers and retrieves lww-register', () => {
    const store = new CrdtStore('node-a');
    const reg = store.register<number>('counter', 'lww-register', 0);
    expect(reg.value()).toBe(0);

    const retrieved = store.get<LWWRegister<number>>('counter');
    expect(retrieved).toBe(reg);
  });

  it('registers and retrieves pn-counter', () => {
    const store = new CrdtStore('node-a');
    const counter = store.register('clicks', 'pn-counter');
    counter.increment();
    counter.increment();
    expect(counter.value()).toBe(2);

    const retrieved = store.get<PNCounter>('clicks');
    expect(retrieved).toBe(counter);
  });

  it('registers and retrieves lww-map', () => {
    const store = new CrdtStore('node-a');
    const map = store.register<string>('settings', 'lww-map');
    map.set('theme', 'dark');
    expect(map.get('theme')).toBe('dark');

    const retrieved = store.get<LWWMap<string>>('settings');
    expect(retrieved).toBe(map);
  });

  it('throws on unknown CRDT type', () => {
    const store = new CrdtStore('node-a');
    expect(() => store.register('x', 'unknown-type' as 'lww-register', null)).toThrow(
      'Unknown CRDT type',
    );
  });

  it('get returns undefined for unregistered key', () => {
    const store = new CrdtStore('node-a');
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('applyRemote applies operation to existing CRDT', () => {
    const store = new CrdtStore('node-a');
    store.register<number>('val', 'lww-register', 0);

    store.applyRemote('val', {
      type: 'lww-register',
      nodeId: 'node-b',
      timestamp: Date.now() + 1000,
      op: 'set',
      value: 42,
    });

    const reg = store.get<LWWRegister<number>>('val');
    expect(reg!.value()).toBe(42);
  });

  it('applyRemote ignores unknown key', () => {
    const store = new CrdtStore('node-a');
    store.applyRemote('nope', {
      type: 'lww-register',
      nodeId: 'node-b',
      timestamp: Date.now(),
      op: 'set',
      value: 1,
    });
    // No error thrown
  });

  it('snapshot returns state of all registered CRDTs', () => {
    const store = new CrdtStore('node-a');
    store.register<number>('r1', 'lww-register', 10);
    store.register('c1', 'pn-counter');

    const snap = store.snapshot();
    expect(Object.keys(snap)).toEqual(['r1', 'c1']);
    expect(snap['r1']!.type).toBe('lww-register');
    expect(snap['r1']!.value).toBe(10);
    expect(snap['c1']!.type).toBe('pn-counter');
    expect(snap['c1']!.value).toBe(0);
  });

  it('queueOperation and drainPendingOps', () => {
    const store = new CrdtStore('node-a');
    const op = {
      type: 'lww-register' as const,
      nodeId: 'node-a',
      timestamp: Date.now(),
      op: 'set' as const,
      value: 1,
    };

    store.queueOperation(op);
    store.queueOperation(op);

    const drained = store.drainPendingOps();
    expect(drained).toHaveLength(2);
    expect(store.drainPendingOps()).toHaveLength(0);
  });

  it('onOps fires when operations are queued', () => {
    const store = new CrdtStore('node-a');
    const received: unknown[][] = [];
    const unsub = store.onOps((ops) => received.push(ops));

    const op = {
      type: 'lww-register' as const,
      nodeId: 'node-a',
      timestamp: Date.now(),
      op: 'set' as const,
      value: 1,
    };
    store.queueOperation(op);

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(1);

    unsub();
    store.queueOperation(op);
    expect(received).toHaveLength(1);
  });
});
