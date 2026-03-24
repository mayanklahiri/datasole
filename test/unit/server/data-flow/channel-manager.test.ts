import { describe, it, expect, vi } from 'vitest';

import { ChannelManager } from '../../../../src/server/primitives/data-flow';

describe('ChannelManager', () => {
  function createDeps() {
    return {
      createSyncChannel: vi.fn(),
      registerEventHandler: vi.fn(),
      registerCrdt: vi.fn(),
    };
  }

  it('creates RPC channel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({ key: 'echo', pattern: 'rpc', granularity: 'immediate' });
    expect(ch.pattern).toBe('rpc');
    expect(ch.key).toBe('echo');
    expect(ch.active).toBe(true);
  });

  it('creates server-event channel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({ key: 'ticker', pattern: 'server-event', granularity: 'immediate' });
    expect(ch.pattern).toBe('server-event');
    expect(deps.registerEventHandler).toHaveBeenCalledWith('ticker', expect.any(Function));
  });

  it('creates server-live-state channel with SyncChannel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({
      key: 'dashboard',
      pattern: 'server-live-state',
      granularity: 'batched',
      batchIntervalMs: 200,
    });
    expect(ch.pattern).toBe('server-live-state');
    expect(deps.createSyncChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'dashboard',
        direction: 'server-to-client',
        mode: 'json-patch',
        flush: expect.objectContaining({ flushStrategy: 'batched', batchIntervalMs: 200 }),
      }),
    );
  });

  it('creates client-live-state channel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({
      key: 'form',
      pattern: 'client-live-state',
      granularity: 'debounced',
      debounceMs: 300,
    });
    expect(ch.pattern).toBe('client-live-state');
    expect(deps.createSyncChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'form',
        direction: 'client-to-server',
        mode: 'json-patch',
        flush: expect.objectContaining({ flushStrategy: 'debounced', debounceMs: 300 }),
      }),
    );
  });

  it('creates bidirectional-crdt channel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({
      key: 'collab',
      pattern: 'bidirectional-crdt',
      granularity: 'immediate',
    });
    expect(ch.pattern).toBe('bidirectional-crdt');
    expect(deps.registerCrdt).toHaveBeenCalledWith('collab', 'lww-map');
    expect(deps.createSyncChannel).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'collab', direction: 'bidirectional', mode: 'crdt' }),
    );
  });

  it('returns existing channel for same key', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch1 = mgr.create({ key: 'k', pattern: 'rpc', granularity: 'immediate' });
    const ch2 = mgr.create({ key: 'k', pattern: 'rpc', granularity: 'immediate' });
    expect(ch1).toBe(ch2);
  });

  it('close() deactivates channel', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    const ch = mgr.create({ key: 'x', pattern: 'rpc', granularity: 'immediate' });
    ch.close();
    expect(ch.active).toBe(false);
    expect(mgr.get('x')).toBeUndefined();
  });

  it('closeAll() closes all channels', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    mgr.create({ key: 'a', pattern: 'rpc', granularity: 'immediate' });
    mgr.create({ key: 'b', pattern: 'server-event', granularity: 'immediate' });
    expect(mgr.getAll()).toHaveLength(2);
    mgr.closeAll();
    expect(mgr.getAll()).toHaveLength(0);
  });

  it('getAll returns all channels', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    mgr.create({ key: 'a', pattern: 'rpc', granularity: 'immediate' });
    mgr.create({ key: 'b', pattern: 'client-event', granularity: 'immediate' });
    const all = mgr.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.key).sort()).toEqual(['a', 'b']);
  });

  it('bidirectional-event channel registers handler', () => {
    const deps = createDeps();
    const mgr = new ChannelManager(deps);
    mgr.create({ key: 'chat', pattern: 'bidirectional-event', granularity: 'immediate' });
    expect(deps.registerEventHandler).toHaveBeenCalledWith('chat', expect.any(Function));
  });
});
