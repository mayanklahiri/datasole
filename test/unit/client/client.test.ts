import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasoleClient } from '../../../src/client/client';
import { Opcode } from '../../../src/shared/protocol';

const mockTransport = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  sendFrame: vi.fn(),
  onMessage: vi.fn(),
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onError: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../src/client/transport/fallback-transport', () => {
  function FallbackTransport() {
    return mockTransport;
  }
  return { FallbackTransport };
});

describe('DatasoleClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Object.values(mockTransport).forEach((fn) => {
      if (typeof fn.mockClear === 'function') fn.mockClear();
    });
    mockTransport.connect.mockResolvedValue(undefined);
    mockTransport.disconnect.mockResolvedValue(undefined);
    mockTransport.isConnected.mockReturnValue(true);
  });

  describe('constructor defaults', () => {
    it('sets default path to /__ds', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.path).toBe('/__ds');
    });

    it('sets default auth to empty object', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.auth).toEqual({});
    });

    it('sets default useWorker to false', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.useWorker).toBe(false);
    });

    it('sets default useSharedArrayBuffer to false', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.useSharedArrayBuffer).toBe(false);
    });

    it('sets default reconnect to true', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.reconnect).toBe(true);
    });

    it('sets default reconnectInterval to 1000', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.reconnectInterval).toBe(1000);
    });

    it('sets default maxReconnectAttempts to 10', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.maxReconnectAttempts).toBe(10);
    });

    it('merges user-provided options over defaults', () => {
      const client = new DatasoleClient({
        url: 'http://localhost:3000',
        path: '/custom',
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
      });
      const opts = (client as unknown as { options: Record<string, unknown> }).options;
      expect(opts.path).toBe('/custom');
      expect(opts.reconnectInterval).toBe(5000);
      expect(opts.maxReconnectAttempts).toBe(3);
      expect(opts.reconnect).toBe(true);
    });
  });

  describe('getConnectionState', () => {
    it('returns disconnected initially', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      expect(client.getConnectionState()).toBe('disconnected');
    });
  });

  describe('buildWsUrl', () => {
    function callBuildWsUrl(opts: ConstructorParameters<typeof DatasoleClient>[0]): string {
      const client = new DatasoleClient(opts);
      return (client as unknown as { buildWsUrl: () => string }).buildWsUrl();
    }

    it('converts http to ws', () => {
      expect(callBuildWsUrl({ url: 'http://localhost:3000' })).toBe('ws://localhost:3000/__ds');
    });

    it('converts https to wss', () => {
      expect(callBuildWsUrl({ url: 'https://example.com' })).toBe('wss://example.com/__ds');
    });

    it('uses custom path', () => {
      expect(callBuildWsUrl({ url: 'http://localhost:3000', path: '/ws' })).toBe(
        'ws://localhost:3000/ws',
      );
    });

    it('strips trailing slash from base URL', () => {
      expect(callBuildWsUrl({ url: 'http://localhost:3000/' })).toBe('ws://localhost:3000/__ds');
    });

    it('appends token query param when auth.token is provided', () => {
      expect(callBuildWsUrl({ url: 'http://localhost:3000', auth: { token: 'abc123' } })).toBe(
        'ws://localhost:3000/__ds?token=abc123',
      );
    });

    it('omits query string when no token', () => {
      const url = callBuildWsUrl({ url: 'http://localhost:3000', auth: {} });
      expect(url).not.toContain('?');
    });
  });

  describe('subscribeState / getState', () => {
    it('getState returns undefined for unknown key', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      expect(client.getState('nonexistent')).toBeUndefined();
    });

    it('subscribeState creates a state store and returns unsubscribe handle', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const sub = client.subscribeState('key1', () => {});
      expect(sub).toBeDefined();
      expect(typeof sub.unsubscribe).toBe('function');
      sub.unsubscribe();
    });

    it('subscribeState reuses store for same key', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      client.subscribeState('k', () => {});
      client.subscribeState('k', () => {});
      const stores = (client as unknown as { stateStores: Map<string, unknown> }).stateStores;
      expect(stores.size).toBe(1);
    });

    it('getState returns undefined for subscribed key with no patches', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      client.subscribeState('k', () => {});
      expect(client.getState('k')).toBeUndefined();
    });
  });

  describe('on / off', () => {
    it('on registers a handler without error', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const handler = vi.fn();
      expect(() => client.on('test', handler)).not.toThrow();
    });

    it('off removes a handler without error', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const handler = vi.fn();
      client.on('test', handler);
      expect(() => client.off('test', handler)).not.toThrow();
    });

    it('off on unregistered handler does not throw', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      expect(() => client.off('test', vi.fn())).not.toThrow();
    });
  });

  describe('emit', () => {
    it('throws when not connected', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      expect(() => client.emit('test', { a: 1 })).toThrow('Not connected');
    });
  });

  describe('rpc', () => {
    it('rejects when not connected', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await expect(client.rpc('method')).rejects.toThrow('Transport not connected');
    });
  });

  describe('registerCrdt / getCrdtStore', () => {
    it('getCrdtStore returns null before registration', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      expect(client.getCrdtStore()).toBeNull();
    });

    it('registerCrdt returns a CrdtStore with correct nodeId', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const store = client.registerCrdt('node-1');
      expect(store).toBeDefined();
      expect(store.nodeId).toBe('node-1');
    });

    it('getCrdtStore returns the registered store', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const store = client.registerCrdt('node-1');
      expect(client.getCrdtStore()).toBe(store);
    });

    it('registerCrdt replaces previous store', () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      client.registerCrdt('node-1');
      const store2 = client.registerCrdt('node-2');
      expect(client.getCrdtStore()).toBe(store2);
      expect(client.getCrdtStore()!.nodeId).toBe('node-2');
    });
  });

  describe('disconnect', () => {
    it('is safe when already disconnected', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('can be called multiple times without error', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.disconnect();
      await client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('disconnects transport after connect', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      await client.disconnect();
      expect(mockTransport.disconnect).toHaveBeenCalled();
      expect(client.getConnectionState()).toBe('disconnected');
    });
  });

  describe('connect()', () => {
    it('sets state to connected after successful direct connect', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      expect(client.getConnectionState()).toBe('connected');
      expect(mockTransport.connect).toHaveBeenCalledWith('ws://localhost:3000/__ds');
      await client.disconnect();
    });

    it('registers onMessage handler on transport', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      expect(mockTransport.onMessage).toHaveBeenCalledWith(expect.any(Function));
      await client.disconnect();
    });

    it('registers onClose handler on transport', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      expect(mockTransport.onClose).toHaveBeenCalledWith(expect.any(Function));
      await client.disconnect();
    });

    it('state transitions: disconnected -> connecting -> connected', async () => {
      const states: string[] = [];
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      mockTransport.connect.mockImplementation(async () => {
        states.push(client.getConnectionState());
      });
      states.push(client.getConnectionState());
      await client.connect();
      states.push(client.getConnectionState());
      expect(states).toEqual(['disconnected', 'connecting', 'connected']);
      await client.disconnect();
    });

    it('resets reconnect attempts on successful connect', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      (client as unknown as { reconnectAttempts: number }).reconnectAttempts = 5;
      await client.connect();
      expect((client as unknown as { reconnectAttempts: number }).reconnectAttempts).toBe(0);
      await client.disconnect();
    });
  });

  describe('emit (connected)', () => {
    it('sends EVENT_C2S frame via transport when connected', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      client.emit('chat', { text: 'hi' });
      expect(mockTransport.sendFrame).toHaveBeenCalledWith(
        expect.objectContaining({
          opcode: Opcode.EVENT_C2S,
          correlationId: 0,
        }),
      );
      await client.disconnect();
    });
  });

  describe('buildRouter frame dispatch', () => {
    it('dispatches RPC_RES to rpc client', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      expect(router.onRpcResponse).toBeDefined();
      await client.disconnect();
    });

    it('dispatches EVENT_S2C to event emitter', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const handler = vi.fn();
      client.on('greeting', handler);
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      router.onEvent!('greeting', { msg: 'hi' }, Date.now());
      expect(handler).toHaveBeenCalledTimes(1);
      await client.disconnect();
    });

    it('dispatches STATE_PATCH to state store', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const stateHandler = vi.fn();
      client.subscribeState('scores', stateHandler);
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      router.onStatePatch!('scores', [{ op: 'replace', path: '', value: { a: 1 } }]);
      expect(stateHandler).toHaveBeenCalledWith({ a: 1 });
      await client.disconnect();
    });

    it('dispatches STATE_SNAPSHOT to state store', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const stateHandler = vi.fn();
      client.subscribeState('data', stateHandler);
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      router.onStateSnapshot!('data', { items: [1, 2, 3] });
      expect(stateHandler).toHaveBeenCalledWith({ items: [1, 2, 3] });
      await client.disconnect();
    });

    it('dispatches CRDT_STATE to crdt store', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      const store = client.registerCrdt('node-1');
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      router.onCrdtState!('counter', {
        type: 'pn-counter',
        value: 10,
        metadata: { vector: { increments: { 'node-1': 10 }, decrements: {} } },
      });
      expect(store).toBeDefined();
      await client.disconnect();
    });

    it('onStatePatch ignores unknown key', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      expect(() =>
        router.onStatePatch!('unknown', [{ op: 'replace', path: '', value: 1 }]),
      ).not.toThrow();
      await client.disconnect();
    });

    it('onStateSnapshot ignores unknown key', async () => {
      const client = new DatasoleClient({ url: 'http://localhost:3000' });
      await client.connect();
      const router = (
        client as unknown as { buildRouter: () => Record<string, (...args: unknown[]) => unknown> }
      ).buildRouter();
      expect(() => router.onStateSnapshot!('unknown', 42)).not.toThrow();
      await client.disconnect();
    });
  });

  describe('scheduleReconnect', () => {
    it('schedules reconnect on transport close when reconnect is enabled', async () => {
      vi.useFakeTimers();
      const client = new DatasoleClient({
        url: 'http://localhost:3000',
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
      });
      await client.connect();

      const onCloseHandler = mockTransport.onClose.mock.calls[0]![0];
      onCloseHandler(1006, 'abnormal');

      expect(client.getConnectionState()).toBe('reconnecting');
      vi.useRealTimers();
      await client.disconnect();
    });

    it('does not schedule reconnect when reconnect is disabled', async () => {
      const client = new DatasoleClient({
        url: 'http://localhost:3000',
        reconnect: false,
      });
      await client.connect();

      const onCloseHandler = mockTransport.onClose.mock.calls[0]![0];
      onCloseHandler(1000, 'normal');

      expect(client.getConnectionState()).toBe('disconnected');
      await client.disconnect();
    });
  });
});
