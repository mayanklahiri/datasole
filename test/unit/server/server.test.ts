import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';

import { MemoryBackend } from '../../../src/server/backends/memory';
import { DatasoleServer } from '../../../src/server/server';
import { PNCounter } from '../../../src/shared/crdt';
import {
  createLiveTestServer,
  Opcode,
  rpc,
  sendFrame,
  receiveFrame,
  collectFrames,
  tick,
  type LiveTestServer,
} from '../../helpers/live-server';
import { type TestContract, TestRpc, TestEvent, TestState } from '../../helpers/test-contract';

let srv: LiveTestServer<TestContract> | undefined;

function liveSrv(): LiveTestServer<TestContract> {
  if (srv === undefined) {
    throw new Error('test setup error: live server not initialized');
  }
  return srv;
}

afterEach(async () => {
  if (!srv) return;
  const toClose = srv;
  srv = undefined;
  await toClose.close();
});

describe('DatasoleServer — construction', () => {
  it('rejects both stateBackend and backendConfig', async () => {
    expect(
      () =>
        new DatasoleServer({
          stateBackend: new MemoryBackend(),
          backendConfig: { type: 'memory' },
        }),
    ).toThrow(/both/);
  });
});

describe('DatasoleServer — thread-pool executor', () => {
  it('routes RPC frames like async', async () => {
    srv = await createLiveTestServer<TestContract>({
      executor: { model: 'thread-pool', poolSize: 2 },
    });
    liveSrv().ds.rpc.register(TestRpc.Echo, async (params: unknown) => params);
    const ws = await liveSrv().connectWs();
    const res = await rpc(ws, 'echo', { x: 1 }, 1);
    expect(res.result).toEqual({ x: 1 });
    ws.close();
  });
});

describe('DatasoleServer — RPC via live WebSocket', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer<TestContract>();
    liveSrv().ds.rpc.register(TestRpc.Echo, async (params: unknown) => params);
    liveSrv().ds.rpc.register(TestRpc.Add, async (params: { a: number; b: number }) => ({
      sum: params.a + params.b,
    }));
    liveSrv().ds.rpc.register(TestRpc.Boom, async () => {
      throw new Error('Intentional test error');
    });
  });

  it('dispatches RPC request and returns response', async () => {
    const ws = await liveSrv().connectWs();
    const res = await rpc(ws, 'echo', { x: 42 }, 1);
    expect(res.correlationId).toBe(1);
    expect(res.result).toEqual({ x: 42 });
    ws.close();
  });

  it('handles RPC with computation', async () => {
    const ws = await liveSrv().connectWs();
    const res = await rpc(ws, 'add', { a: 10, b: 20 }, 2);
    expect(res.result).toEqual({ sum: 30 });
    ws.close();
  });

  it('returns error for unknown RPC method', async () => {
    const ws = await liveSrv().connectWs();
    const res = await rpc(ws, 'nonexistent', null, 3);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
    ws.close();
  });

  it('returns error when handler throws', async () => {
    const ws = await liveSrv().connectWs();
    const res = await rpc(ws, 'boom', null, 4);
    expect(res.error).toBeDefined();
    expect(res.error!.message).toBe('Intentional test error');
    ws.close();
  });

  it('multiplexes concurrent RPCs by correlationId', async () => {
    const ws = await liveSrv().connectWs();

    const framesPromise = collectFrames(ws, 2);
    sendFrame(ws, Opcode.RPC_REQ, 10, {
      method: 'echo',
      params: 'first',
      correlationId: 10,
    });
    sendFrame(ws, Opcode.RPC_REQ, 11, {
      method: 'echo',
      params: 'second',
      correlationId: 11,
    });
    const frames = await framesPromise;
    const byId = new Map(frames.map((f) => [f.correlationId, f]));
    expect((byId.get(10)!.data as Record<string, unknown>).result).toBe('first');
    expect((byId.get(11)!.data as Record<string, unknown>).result).toBe('second');
    ws.close();
  });
});

describe('DatasoleServer — events via live WebSocket', () => {
  it('EVENT_C2S fires registered event handler on server', async () => {
    srv = await createLiveTestServer<TestContract>();
    const received: unknown[] = [];
    liveSrv().ds.events.on(TestEvent.Chat, (payload) => received.push(payload));

    const ws = await liveSrv().connectWs();
    sendFrame(ws, Opcode.EVENT_C2S, 0, { event: 'chat', data: 'hello' });
    await tick(50);

    expect(received.length).toBe(1);
    expect((received[0] as Record<string, unknown>).event).toBe('chat');
    expect((received[0] as Record<string, unknown>).data).toBe('hello');
    ws.close();
  });

  it('broadcast sends EVENT_S2C to all connected clients', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws1 = await liveSrv().connectWs();
    const ws2 = await liveSrv().connectWs();

    const p1 = receiveFrame(ws1);
    const p2 = receiveFrame(ws2);
    liveSrv().ds.broadcast(TestEvent.Notify, { msg: 'hi' });

    const [f1, f2] = await Promise.all([p1, p2]);
    expect(f1.opcode).toBe(Opcode.EVENT_S2C);
    expect((f1.data as Record<string, unknown>).event).toBe('notify');
    expect(f2.opcode).toBe(Opcode.EVENT_S2C);
    ws1.close();
    ws2.close();
  });

  it('off removes server-side handler', async () => {
    srv = await createLiveTestServer<TestContract>();
    const handler = vi.fn();
    liveSrv().ds.events.on(TestEvent.Ev, handler);
    liveSrv().ds.events.off(TestEvent.Ev, handler);

    const ws = await liveSrv().connectWs();
    sendFrame(ws, Opcode.EVENT_C2S, 0, { event: 'ev', data: 'x' });
    await tick(50);

    expect(handler).not.toHaveBeenCalled();
    ws.close();
  });
});

describe('DatasoleServer — PING/PONG via live WebSocket', () => {
  it('responds to PING with PONG', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();

    sendFrame(ws, Opcode.PING, 99, null);
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.PONG);
    expect(resp.correlationId).toBe(99);
    ws.close();
  });
});

describe('DatasoleServer — state management via live WebSocket', () => {
  it('setState and getState round-trip', async () => {
    srv = await createLiveTestServer<TestContract>();
    await liveSrv().ds.setState(TestState.Key1, { foo: 'bar' });
    expect(await liveSrv().ds.getState(TestState.Key1)).toEqual({ foo: 'bar' });
  });

  it('setState broadcasts STATE_PATCH to connected clients', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();
    await tick(20);

    await liveSrv().ds.setState(TestState.Obj, { a: 1 });
    const patchPromise = receiveFrame(ws);
    await liveSrv().ds.setState(TestState.Obj, { a: 2 });

    const resp = await patchPromise;
    expect(resp.opcode).toBe(Opcode.STATE_PATCH);
    const data = resp.data as { key: string; patches: unknown[] };
    expect(data.key).toBe(TestState.Obj);
    expect(data.patches.length).toBeGreaterThan(0);
    ws.close();
  });

  it('setState via sync channel with immediate flush', async () => {
    srv = await createLiveTestServer<TestContract>();
    const channel = liveSrv().ds.createSyncChannel({
      key: TestState.Synced,
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    expect(liveSrv().ds.getSyncChannel(TestState.Synced)).toBe(channel);

    const ws = await liveSrv().connectWs();
    await tick(20);

    await liveSrv().ds.setState(TestState.Synced, { a: 1 });
    const patchPromise = receiveFrame(ws);
    await liveSrv().ds.setState(TestState.Synced, { a: 2 });
    const resp = await patchPromise;
    expect(resp.opcode).toBe(Opcode.STATE_PATCH);

    await channel.destroy();
    ws.close();
  });
});

describe('DatasoleServer — CRDT operations via live WebSocket', () => {
  it('CRDT_OP applies pn-counter and broadcasts CRDT_STATE', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();

    const crdtOp = {
      key: 'counter',
      op: {
        type: 'pn-counter',
        nodeId: 'c1',
        timestamp: Date.now(),
        op: 'increment',
        value: 5,
      },
    };
    sendFrame(ws, Opcode.CRDT_OP, 0, crdtOp);
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.CRDT_STATE);
    const data = resp.data as { key: string; state: { type: string; value: number } };
    expect(data.key).toBe('counter');
    expect(data.state.type).toBe('pn-counter');
    expect(data.state.value).toBe(5);
    ws.close();
  });

  it('CRDT_OP applies lww-register', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();

    sendFrame(ws, Opcode.CRDT_OP, 0, {
      key: 'reg1',
      op: {
        type: 'lww-register',
        nodeId: 'c1',
        timestamp: Date.now(),
        op: 'set',
        value: 'hello',
      },
    });
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.CRDT_STATE);
    const data = resp.data as { key: string; state: { type: string; value: string } };
    expect(data.state.type).toBe('lww-register');
    expect(data.state.value).toBe('hello');
    ws.close();
  });

  it('CRDT_OP applies lww-map', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();

    sendFrame(ws, Opcode.CRDT_OP, 0, {
      key: 'map1',
      op: {
        type: 'lww-map',
        nodeId: 'c1',
        timestamp: Date.now(),
        op: 'set',
        key: 'field',
        value: 42,
      },
    });
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.CRDT_STATE);
    const data = resp.data as { key: string; state: { type: string } };
    expect(data.state.type).toBe('lww-map');
    ws.close();
  });

  it('registerCrdt and getCrdtState work', async () => {
    srv = await createLiveTestServer<TestContract>();
    const counter = new PNCounter('server');
    liveSrv().ds.crdt.register('myCounter', counter);
    expect(liveSrv().ds.crdt.getState('myCounter')).toBeDefined();
    expect(liveSrv().ds.crdt.getState('nonexistent')).toBeUndefined();
  });

  it('CRDT_OP uses connectionId as key when op.key is undefined', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ws = await liveSrv().connectWs();

    sendFrame(ws, Opcode.CRDT_OP, 0, {
      key: undefined,
      op: {
        type: 'pn-counter',
        nodeId: 'c1',
        timestamp: Date.now(),
        op: 'increment',
        value: 3,
      },
    });
    const resp = await receiveFrame(ws);
    expect(resp.opcode).toBe(Opcode.CRDT_STATE);
    ws.close();
  });
});

describe('DatasoleServer — rate limiting via live WebSocket', () => {
  it('rate limit exceeded sends ERROR frame', async () => {
    srv = await createLiveTestServer<TestContract>({
      rateLimit: {
        defaultRule: { windowMs: 60_000, maxRequests: 0 },
      },
    });

    const ws = await liveSrv().connectWs();
    sendFrame(ws, Opcode.PING, 10, null);
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.ERROR);
    const data = resp.data as { message: string; retryAfter: number };
    expect(data.message).toBe('Rate limit exceeded');
    expect(data.retryAfter).toBeGreaterThan(0);
    ws.close();
  });
});

describe('DatasoleServer — malformed frames', () => {
  it('malformed binary data does not crash the server', async () => {
    srv = await createLiveTestServer<TestContract>();
    liveSrv().ds.rpc.register(TestRpc.Echo, async (p: unknown) => p);
    const ws = await liveSrv().connectWs();

    ws.send(new Uint8Array([0xff, 0xfe, 0xab, 0x12]));
    await tick(50);

    const res = await rpc(ws, 'echo', 'still alive', 1);
    expect(res.result).toBe('still alive');
    ws.close();
  });
});

describe('DatasoleServer — auth via live WebSocket', () => {
  it('authenticated connection proceeds', async () => {
    srv = await createLiveTestServer<TestContract>({
      authHandler: async (req) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const token = url.searchParams.get('token');
        if (token === 'valid') return { authenticated: true, userId: 'alice' };
        return { authenticated: false };
      },
    });
    liveSrv().ds.rpc.register(
      TestRpc.Whoami,
      async (_p, ctx) => ctx?.connection?.userId ?? 'unknown',
    );

    const ws = await liveSrv().connectWs({ token: 'valid' });
    const res = await rpc(ws, 'whoami', null, 1);
    expect(res.result).toBe('alice');
    ws.close();
  });

  it('unauthenticated connection is rejected', async () => {
    srv = await createLiveTestServer<TestContract>({
      authHandler: async () => ({ authenticated: false }),
    });

    await expect(liveSrv().connectWs()).rejects.toThrow();
  });
});

describe('DatasoleServer — connection tracking', () => {
  it('tracks connection count', async () => {
    srv = await createLiveTestServer<TestContract>();
    expect(liveSrv().ds.getConnectionCount()).toBe(0);

    const ws1 = await liveSrv().connectWs();
    await tick(20);
    expect(liveSrv().ds.getConnectionCount()).toBe(1);

    const ws2 = await liveSrv().connectWs();
    await tick(20);
    expect(liveSrv().ds.getConnectionCount()).toBe(2);

    ws1.close();
    await tick(50);
    expect(liveSrv().ds.getConnectionCount()).toBe(1);

    ws2.close();
    await tick(50);
    expect(liveSrv().ds.getConnectionCount()).toBe(0);
  });
});

describe('DatasoleServer — data channels', () => {
  it('createDataChannel and getDataChannel', async () => {
    srv = await createLiveTestServer<TestContract>();
    const ch = liveSrv().ds.createDataChannel({
      key: 'live',
      pattern: 'server-live-state',
      granularity: 'immediate',
      initialValue: 0,
    });
    expect(ch).toBeDefined();
    expect(liveSrv().ds.getDataChannel('live')).toBe(ch);
  });
});

describe('DatasoleServer — session', () => {
  it('set and get session value', async () => {
    srv = await createLiveTestServer<TestContract>();
    liveSrv().ds.sessions.set('user1', 'theme', 'dark');
    expect(liveSrv().ds.sessions.get('user1', 'theme')).toBe('dark');
    expect(liveSrv().ds.sessions.get('user1', 'missing')).toBeUndefined();
  });

  it('onSessionChange fires handler', async () => {
    srv = await createLiveTestServer<TestContract>();
    const handler = vi.fn();
    const unsub = liveSrv().ds.sessions.onChange(handler);
    liveSrv().ds.sessions.set('u1', 'lang', 'en');
    expect(handler).toHaveBeenCalledWith('u1', 'lang', 'en', expect.any(Number));
    unsub();
    liveSrv().ds.sessions.set('u1', 'lang', 'fr');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('DatasoleServer — getters', () => {
  it('metrics returns MetricsCollector', async () => {
    srv = await createLiveTestServer<TestContract>();
    expect(liveSrv().ds.metrics).toBeDefined();
  });

  it('rateLimiter returns limiter', async () => {
    srv = await createLiveTestServer<TestContract>();
    expect(liveSrv().ds.rateLimiter).toBeDefined();
  });
});

describe('DatasoleServer — close', () => {
  it('close clears connections, CRDTs, and sync channels', async () => {
    srv = await createLiveTestServer<TestContract>();
    const instance = liveSrv();
    instance.ds.crdt.register('c', new PNCounter('s'));
    instance.ds.createSyncChannel({
      key: 'sc',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', batchIntervalMs: 100 },
    });

    const ws = await instance.connectWs();
    await tick(20);
    expect(instance.ds.getConnectionCount()).toBeGreaterThan(0);

    await instance.ds.close();

    expect(instance.ds.getConnectionCount()).toBe(0);
    expect(instance.ds.crdt.getState('c')).toBeUndefined();
    expect(instance.ds.getSyncChannel('sc')).toBeUndefined();
    ws.close();

    await new Promise<void>((resolve, reject) => {
      instance.httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    srv = undefined;
  });

  it('close is safe to call when no wsServer attached', async () => {
    const ds = new DatasoleServer<TestContract>();
    await expect(ds.close()).resolves.toBeUndefined();
  });
});

describe('DatasoleServer — metrics increment on traffic', () => {
  it('increments messagesIn and messagesOut on RPC', async () => {
    srv = await createLiveTestServer<TestContract>();
    liveSrv().ds.rpc.register(TestRpc.Ping, async () => 'pong');

    const ws = await liveSrv().connectWs();
    await rpc(ws, 'ping', null, 1);

    const snap = liveSrv().ds.metrics.snapshot();
    expect(snap.messagesIn).toBeGreaterThanOrEqual(1);
    expect(snap.messagesOut).toBeGreaterThanOrEqual(1);
    ws.close();
  });
});

describe('DatasoleServer — multiple clients', () => {
  it('broadcasts state patches to all connected clients', async () => {
    srv = await createLiveTestServer<TestContract>();
    const clients: WebSocket[] = [];
    for (let i = 0; i < 3; i++) {
      clients.push(await liveSrv().connectWs());
    }
    await tick(20);

    await liveSrv().ds.setState(TestState.Shared, { v: 1 });

    const promises = clients.map((ws) => receiveFrame(ws));
    await liveSrv().ds.setState(TestState.Shared, { v: 2 });
    const frames = await Promise.all(promises);

    for (const f of frames) {
      expect(f.opcode).toBe(Opcode.STATE_PATCH);
      expect((f.data as Record<string, unknown>).key).toBe(TestState.Shared);
    }

    for (const ws of clients) ws.close();
  });
});
