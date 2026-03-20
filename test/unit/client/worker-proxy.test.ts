import { describe, it, expect, vi } from 'vitest';

import { WorkerProxy } from '../../../src/client/transport/worker-proxy';

describe('WorkerProxy', () => {
  it('constructs without error and exposes expected API', () => {
    const p = new WorkerProxy();
    expect(typeof p.connect).toBe('function');
    expect(typeof p.send).toBe('function');
    expect(typeof p.disconnect).toBe('function');
    expect(typeof p.on).toBe('function');
    expect(typeof p.off).toBe('function');
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
