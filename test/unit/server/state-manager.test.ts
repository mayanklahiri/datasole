import { describe, it, expect, vi } from 'vitest';

import { MemoryBackend } from '../../../src/server/state/backends/memory';
import { StateManager } from '../../../src/server/state/state-manager';

describe('StateManager', () => {
  it('setState returns patches and getState returns value', async () => {
    const backend = new MemoryBackend();
    const mgr = new StateManager(backend);
    const patches = await mgr.setState('k', { a: 1 });
    expect(patches.length).toBeGreaterThan(0);
    expect(await mgr.getState('k')).toEqual({ a: 1 });
  });

  it('setState with same value returns empty patches', async () => {
    const backend = new MemoryBackend();
    const mgr = new StateManager(backend);
    await mgr.setState('k', { x: 1 });
    const second = await mgr.setState('k', { x: 1 });
    expect(second).toEqual([]);
  });

  it('subscribe receives publishes from backend', async () => {
    const backend = new MemoryBackend();
    const mgr = new StateManager(backend);
    const fn = vi.fn();
    mgr.subscribe('k', fn);
    await mgr.setState('k', 1);
    expect(fn).toHaveBeenCalledWith('k', expect.any(Array));
  });
});
