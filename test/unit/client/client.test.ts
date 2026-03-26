import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NodeWebSocket from 'ws';

import { DatasoleClient, type DatasoleClientOptions } from '../../../src/client/client';
import type { ClientEventEmitter } from '../../../src/client/events/event-emitter';
import type { StateStore } from '../../../src/client/state/state-store';
import type { DatasoleContract } from '../../../src/shared/contract';
import { createLiveTestServer, tick, type LiveTestServer } from '../../helpers/live-server';
import { type TestContract, TestRpc, TestEvent, TestState } from '../../helpers/test-contract';

/** Narrow view of private fields used only in these unit tests. */
interface DatasoleClientInstanceView {
  readonly options: Required<DatasoleClientOptions>;
  buildWsUrl(): string;
  readonly stateStores: Map<string, StateStore<unknown>>;
  readonly eventEmitter: ClientEventEmitter;
  reconnectAttempts: number;
}

function clientInternals<T extends DatasoleContract>(
  client: DatasoleClient<T>,
): DatasoleClientInstanceView {
  // Private fields are intentionally exposed only for these tests.
  return client as unknown as DatasoleClientInstanceView;
}

/**
 * Polyfill the browser WebSocket global with the `ws` library so
 * FallbackTransport (which uses `new WebSocket(url)`) works in Node.
 */
beforeEach(() => {
  vi.stubGlobal('WebSocket', NodeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let srv!: LiveTestServer<TestContract>;

afterEach(async () => {
  if (srv) await srv.close();
});

// ---------------------------------------------------------------------------
// Pure unit tests (no live server needed)
// ---------------------------------------------------------------------------

describe('DatasoleClient — constructor defaults', () => {
  it('sets default path to /__ds', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.path).toBe('/__ds');
  });

  it('sets default auth to empty object', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.auth).toEqual({});
  });

  it('sets default useWorker to true', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.useWorker).toBe(true);
  });

  it('sets default useSharedArrayBuffer to false', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.useSharedArrayBuffer).toBe(false);
  });

  it('sets default reconnect to true', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.reconnect).toBe(true);
  });

  it('sets default reconnectInterval to 1000', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.reconnectInterval).toBe(1000);
  });

  it('sets default maxReconnectAttempts to 10', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const opts = clientInternals(client).options;
    expect(opts.maxReconnectAttempts).toBe(10);
  });

  it('merges user-provided options over defaults', () => {
    const client = new DatasoleClient<TestContract>({
      url: 'http://localhost:3000',
      path: '/custom',
      reconnectInterval: 5000,
      maxReconnectAttempts: 3,
    });
    const opts = clientInternals(client).options;
    expect(opts.path).toBe('/custom');
    expect(opts.reconnectInterval).toBe(5000);
    expect(opts.maxReconnectAttempts).toBe(3);
    expect(opts.reconnect).toBe(true);
  });
});

describe('DatasoleClient — buildWsUrl', () => {
  function callBuildWsUrl(opts: ConstructorParameters<typeof DatasoleClient>[0]): string {
    const client = new DatasoleClient<TestContract>(opts);
    return clientInternals(client).buildWsUrl();
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

describe('DatasoleClient — getConnectionState', () => {
  it('returns disconnected initially', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    expect(client.getConnectionState()).toBe('disconnected');
  });
});

describe('DatasoleClient — subscribeState / getState', () => {
  it('getState returns undefined for unknown key', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    expect(client.getState(TestState.Dashboard)).toBeUndefined();
  });

  it('subscribeState returns unsubscribe handle', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const sub = client.subscribeState(TestState.Dashboard, () => {});
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    sub.unsubscribe();
  });

  it('subscribeState reuses store for same key', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    client.subscribeState(TestState.Dashboard, () => {});
    client.subscribeState(TestState.Dashboard, () => {});
    const stores = clientInternals(client).stateStores;
    expect(stores.size).toBe(1);
  });
});

describe('DatasoleClient — on / off', () => {
  it('on registers a handler that receives emitted events', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const handler = vi.fn();
    client.on(TestEvent.TestEvent, handler);

    clientInternals(client).eventEmitter.emit(TestEvent.TestEvent, { x: 1 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]).toHaveProperty('data', { x: 1 });
  });

  it('off removes a handler so it no longer receives events', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const handler = vi.fn();
    client.on(TestEvent.TestEvent, handler);
    client.off(TestEvent.TestEvent, handler);

    clientInternals(client).eventEmitter.emit(TestEvent.TestEvent, { x: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('multiple handlers on the same event all fire', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const h1 = vi.fn();
    const h2 = vi.fn();
    client.on(TestEvent.Ev, h1);
    client.on(TestEvent.Ev, h2);

    clientInternals(client).eventEmitter.emit(TestEvent.Ev, null);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('off only removes the specified handler', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const h1 = vi.fn();
    const h2 = vi.fn();
    client.on(TestEvent.Ev, h1);
    client.on(TestEvent.Ev, h2);
    client.off(TestEvent.Ev, h1);

    clientInternals(client).eventEmitter.emit(TestEvent.Ev, null);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });
});

describe('DatasoleClient — registerCrdt / getCrdtStore', () => {
  it('getCrdtStore returns null before registration', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    expect(client.getCrdtStore()).toBeNull();
  });

  it('registerCrdt returns a CrdtStore with correct nodeId', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const store = client.registerCrdt('node-1');
    expect(store.nodeId).toBe('node-1');
  });

  it('getCrdtStore returns the registered store', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    const store = client.registerCrdt('node-1');
    expect(client.getCrdtStore()).toBe(store);
  });

  it('registerCrdt replaces previous store', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    client.registerCrdt('node-1');
    const store2 = client.registerCrdt('node-2');
    expect(client.getCrdtStore()).toBe(store2);
    expect(client.getCrdtStore()!.nodeId).toBe('node-2');
  });
});

describe('DatasoleClient — emit when not connected', () => {
  it('throws when not connected', () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    expect(() => client.emit(TestEvent.TestEvent, { a: 1 })).toThrow('Not connected');
  });
});

describe('DatasoleClient — rpc when not connected', () => {
  it('rejects when not connected', async () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    await expect(client.rpc(TestRpc.Echo)).rejects.toThrow('Transport not connected');
  });
});

describe('DatasoleClient — disconnect safety', () => {
  it('is safe when already disconnected', async () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    await client.disconnect();
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('can be called multiple times', async () => {
    const client = new DatasoleClient<TestContract>({ url: 'http://localhost:3000' });
    await client.disconnect();
    await client.disconnect();
    expect(client.getConnectionState()).toBe('disconnected');
  });
});

// ---------------------------------------------------------------------------
// Integration tests with live server
// ---------------------------------------------------------------------------

describe('DatasoleClient — connect to live server', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer<TestContract>();
    srv.ds.rpc.register(TestRpc.Echo, async (params: unknown) => params);
    srv.ds.rpc.register(TestRpc.Add, async (params) => ({
      sum: params.a + params.b,
    }));
  });

  it('connects and transitions to connected state', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();
    expect(client.getConnectionState()).toBe('connected');
    await client.disconnect();
  });

  it('disconnects cleanly after connect', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();
    await client.disconnect();
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('performs RPC echo through live server', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();
    const result = (await client.rpc(TestRpc.Echo, { x: 42 })) as { x: number };
    expect(result).toEqual({ x: 42 });
    await client.disconnect();
  });

  it('performs RPC add through live server', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();
    const result = await client.rpc(TestRpc.Add, { a: 10, b: 20 });
    expect(result.sum).toBe(30);
    await client.disconnect();
  });

  it('emits event that reaches server', async () => {
    const received: unknown[] = [];
    srv.ds.primitives.events.on(TestEvent.TestEvent, (payload) => received.push(payload));

    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();
    client.emit(TestEvent.TestEvent, { hello: 'world' });
    await tick(50);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect((received[0] as Record<string, unknown>).data).toEqual({ hello: 'world' });
    await client.disconnect();
  });

  it('receives broadcast events from server', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    const received: unknown[] = [];
    client.on(TestEvent.ServerNotify, (payload) => received.push(payload));
    await client.connect();
    await tick(20);

    srv.ds.primitives.fanout.broadcast(TestEvent.ServerNotify, { msg: 'broadcast-test' });
    await tick(100);

    expect(received.length).toBe(1);
    expect((received[0] as Record<string, unknown>).data).toEqual({ msg: 'broadcast-test' });
    await client.disconnect();
  });

  it('receives state patches from server', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    const states: unknown[] = [];
    client.subscribeState(TestState.Dashboard, (s) => states.push(s));
    await client.connect();
    await tick(20);

    await srv.ds.primitives.live.setState(TestState.Dashboard, { visitors: 0 });
    await srv.ds.primitives.live.setState(TestState.Dashboard, { visitors: 42 });
    await tick(100);

    expect(states.length).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  it('resets reconnect attempts on successful connect', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    clientInternals(client).reconnectAttempts = 5;
    await client.connect();
    expect(clientInternals(client).reconnectAttempts).toBe(0);
    await client.disconnect();
  });
});

describe('DatasoleClient — auth with live server', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer<TestContract>({
      authHandler: async (req) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const token = url.searchParams.get('token');
        if (token === 'valid') return { authenticated: true, userId: 'alice' };
        return { authenticated: false };
      },
    });
    srv.ds.rpc.register(
      TestRpc.Whoami,
      async (_p: unknown, ctx) => ctx.connection.userId ?? 'unknown',
    );
  });

  it('connects with valid token', async () => {
    const client = new DatasoleClient<TestContract>({
      url: srv.url,
      auth: { token: 'valid' },
      reconnect: false,
    });
    await client.connect();
    const result = await client.rpc(TestRpc.Whoami);
    expect(result).toBe('alice');
    await client.disconnect();
  });

  it('fails to connect with invalid token', async () => {
    const client = new DatasoleClient<TestContract>({
      url: srv.url,
      auth: { token: 'invalid' },
      reconnect: false,
    });
    await expect(client.connect()).rejects.toThrow();
  });
});

describe('DatasoleClient — reconnection with live server', () => {
  it('transitions to reconnecting when server closes connection', async () => {
    srv = await createLiveTestServer<TestContract>();
    const client = new DatasoleClient<TestContract>({
      url: srv.url,
      reconnect: true,
      reconnectInterval: 100,
      maxReconnectAttempts: 1,
    });
    await client.connect();
    expect(client.getConnectionState()).toBe('connected');

    await srv.ds.close();
    await tick(50);

    expect(client.getConnectionState()).toBe('reconnecting');
    await client.disconnect();
  });

  it('does not reconnect when reconnect is disabled', async () => {
    srv = await createLiveTestServer<TestContract>();
    const client = new DatasoleClient<TestContract>({
      url: srv.url,
      reconnect: false,
    });
    await client.connect();

    await srv.ds.close();
    await tick(50);

    expect(client.getConnectionState()).toBe('disconnected');
    await client.disconnect();
  });
});

describe('DatasoleClient — multiple concurrent RPCs', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer<TestContract>();
    srv.ds.rpc.register(TestRpc.Echo, async (params: unknown) => params);
    srv.ds.rpc.register(TestRpc.Slow, async (params) => {
      const p = params as { ms: number; v: unknown };
      await new Promise((r) => setTimeout(r, p.ms));
      return p.v;
    });
  });

  it('resolves multiple RPCs concurrently', async () => {
    const client = new DatasoleClient<TestContract>({ url: srv.url, reconnect: false });
    await client.connect();

    const [r1, r2, r3] = await Promise.all([
      client.rpc(TestRpc.Echo, 'a'),
      client.rpc(TestRpc.Echo, 'b'),
      client.rpc(TestRpc.Echo, 'c'),
    ]);

    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(r3).toBe('c');
    await client.disconnect();
  });
});
