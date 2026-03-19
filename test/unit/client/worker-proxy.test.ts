import { describe, it, expect, vi } from 'vitest';

import { WorkerProxy } from '../../../src/client/transport/worker-proxy';

describe('WorkerProxy', () => {
  it('constructs without error and exposes expected API', () => {
    const p = new WorkerProxy();
    expect(p.connect).toBeTypeOf('function');
    expect(p.send).toBeTypeOf('function');
    expect(p.disconnect).toBeTypeOf('function');
    expect(p.on).toBeTypeOf('function');
    expect(p.off).toBeTypeOf('function');
  });

  it('on adds listener and off removes it', () => {
    const p = new WorkerProxy();
    const handler = vi.fn();
    p.on('msg', handler);
    const internal = p as unknown as {
      listeners: Map<string, Set<(...args: unknown[]) => void>>;
    };
    expect(internal.listeners.get('msg')?.has(handler)).toBe(true);
    p.off('msg', handler);
    expect(internal.listeners.get('msg')?.has(handler)).toBe(false);
  });
});
