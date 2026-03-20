import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';

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

let srv: LiveTestServer;

afterEach(async () => {
  if (srv) await srv.close();
});

describe('DatasoleServer — RPC via live WebSocket', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer();
    srv.ds.rpc('echo', async (params: unknown) => params);
    srv.ds.rpc('add', async (params: { a: number; b: number }) => ({
      sum: params.a + params.b,
    }));
    srv.ds.rpc('boom', async () => {
      throw new Error('Intentional test error');
    });
  });

  it('dispatches RPC request and returns response', async () => {
    const ws = await srv.connectWs();
    const res = await rpc(ws, 'echo', { x: 42 }, 1);
    expect(res.correlationId).toBe(1);
    expect(res.result).toEqual({ x: 42 });
    ws.close();
  });

  it('handles RPC with computation', async () => {
    const ws = await srv.connectWs();
    const res = await rpc(ws, 'add', { a: 10, b: 20 }, 2);
    expect(res.result).toEqual({ sum: 30 });
    ws.close();
  });

  it('returns error for unknown RPC method', async () => {
    const ws = await srv.connectWs();
    const res = await rpc(ws, 'nonexistent', null, 3);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
    ws.close();
  });

  it('returns error when handler throws', async () => {
    const ws = await srv.connectWs();
    const res = await rpc(ws, 'boom', null, 4);
    expect(res.error).toBeDefined();
    expect(res.error!.message).toBe('Intentional test error');
    ws.close();
  });

  it('multiplexes concurrent RPCs by correlationId', async () => {
    const ws = await srv.connectWs();

    // Set up listener before sending to avoid race
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
    srv = await createLiveTestServer();
    const received: unknown[] = [];
    srv.ds.on('chat', (payload) => received.push(payload));

    const ws = await srv.connectWs();
    sendFrame(ws, Opcode.EVENT_C2S, 0, { event: 'chat', data: 'hello' });
    await tick(50);

    expect(received.length).toBe(1);
    expect((received[0] as Record<string, unknown>).event).toBe('chat');
    expect((received[0] as Record<string, unknown>).data).toBe('hello');
    ws.close();
  });

  it('broadcast sends EVENT_S2C to all connected clients', async () => {
    srv = await createLiveTestServer();
    const ws1 = await srv.connectWs();
    const ws2 = await srv.connectWs();

    const p1 = receiveFrame(ws1);
    const p2 = receiveFrame(ws2);
    srv.ds.broadcast('notify', { msg: 'hi' });

    const [f1, f2] = await Promise.all([p1, p2]);
    expect(f1.opcode).toBe(Opcode.EVENT_S2C);
    expect((f1.data as Record<string, unknown>).event).toBe('notify');
    expect(f2.opcode).toBe(Opcode.EVENT_S2C);
    ws1.close();
    ws2.close();
  });

  it('off removes server-side handler', async () => {
    srv = await createLiveTestServer();
    const handler = vi.fn();
    srv.ds.on('ev', handler);
    srv.ds.off('ev', handler);

    const ws = await srv.connectWs();
    sendFrame(ws, Opcode.EVENT_C2S, 0, { event: 'ev', data: 'x' });
    await tick(50);

    expect(handler).not.toHaveBeenCalled();
    ws.close();
  });
});

describe('DatasoleServer — PING/PONG via live WebSocket', () => {
  it('responds to PING with PONG', async () => {
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();

    sendFrame(ws, Opcode.PING, 99, null);
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.PONG);
    expect(resp.correlationId).toBe(99);
    ws.close();
  });
});

describe('DatasoleServer — state management via live WebSocket', () => {
  it('setState and getState round-trip', async () => {
    srv = await createLiveTestServer();
    await srv.ds.setState('key1', { foo: 'bar' });
    expect(await srv.ds.getState('key1')).toEqual({ foo: 'bar' });
  });

  it('setState broadcasts STATE_PATCH to connected clients', async () => {
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();
    await tick(20);

    await srv.ds.setState('obj', { a: 1 });
    const patchPromise = receiveFrame(ws);
    await srv.ds.setState('obj', { a: 2 });

    const resp = await patchPromise;
    expect(resp.opcode).toBe(Opcode.STATE_PATCH);
    const data = resp.data as { key: string; patches: unknown[] };
    expect(data.key).toBe('obj');
    expect(data.patches.length).toBeGreaterThan(0);
    ws.close();
  });

  it('setState via sync channel with immediate flush', async () => {
    srv = await createLiveTestServer();
    const channel = srv.ds.createSyncChannel({
      key: 'synced',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    expect(srv.ds.getSyncChannel('synced')).toBe(channel);

    const ws = await srv.connectWs();
    await tick(20);

    await srv.ds.setState('synced', { a: 1 });
    const patchPromise = receiveFrame(ws);
    await srv.ds.setState('synced', { a: 2 });
    const resp = await patchPromise;
    expect(resp.opcode).toBe(Opcode.STATE_PATCH);

    channel.destroy();
    ws.close();
  });
});

describe('DatasoleServer — CRDT operations via live WebSocket', () => {
  it('CRDT_OP applies pn-counter and broadcasts CRDT_STATE', async () => {
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();

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
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();

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
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();

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
    srv = await createLiveTestServer();
    const counter = new PNCounter('server');
    srv.ds.registerCrdt('myCounter', counter);
    expect(srv.ds.getCrdtState('myCounter')).toBeDefined();
    expect(srv.ds.getCrdtState('nonexistent')).toBeUndefined();
  });

  it('CRDT_OP uses connectionId as key when op.key is undefined', async () => {
    srv = await createLiveTestServer();
    const ws = await srv.connectWs();

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
    srv = await createLiveTestServer({
      rateLimiter: {
        check: async () => ({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 }),
        consume: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() + 5000,
          retryAfter: 5000,
        }),
        reset: async () => {},
      },
    });

    const ws = await srv.connectWs();
    sendFrame(ws, Opcode.PING, 10, null);
    const resp = await receiveFrame(ws);

    expect(resp.opcode).toBe(Opcode.ERROR);
    const data = resp.data as { message: string; retryAfter: number };
    expect(data.message).toBe('Rate limit exceeded');
    expect(data.retryAfter).toBe(5000);
    ws.close();
  });
});

describe('DatasoleServer — malformed frames', () => {
  it('malformed binary data does not crash the server', async () => {
    srv = await createLiveTestServer();
    srv.ds.rpc('echo', async (p: unknown) => p);
    const ws = await srv.connectWs();

    ws.send(new Uint8Array([0xff, 0xfe, 0xab, 0x12]));
    await tick(50);

    const res = await rpc(ws, 'echo', 'still alive', 1);
    expect(res.result).toBe('still alive');
    ws.close();
  });
});

describe('DatasoleServer — auth via live WebSocket', () => {
  it('authenticated connection proceeds', async () => {
    srv = await createLiveTestServer({
      authHandler: async (req) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const token = url.searchParams.get('token');
        if (token === 'valid') return { authenticated: true, userId: 'alice' };
        return { authenticated: false };
      },
    });
    srv.ds.rpc('whoami', async (_p, ctx) => ctx?.connection?.userId ?? 'unknown');

    const ws = await srv.connectWs({ token: 'valid' });
    const res = await rpc(ws, 'whoami', null, 1);
    expect(res.result).toBe('alice');
    ws.close();
  });

  it('unauthenticated connection is rejected', async () => {
    srv = await createLiveTestServer({
      authHandler: async () => ({ authenticated: false }),
    });

    await expect(srv.connectWs()).rejects.toThrow();
  });
});

describe('DatasoleServer — connection tracking', () => {
  it('tracks connection count', async () => {
    srv = await createLiveTestServer();
    expect(srv.ds.getConnectionCount()).toBe(0);

    const ws1 = await srv.connectWs();
    await tick(20);
    expect(srv.ds.getConnectionCount()).toBe(1);

    const ws2 = await srv.connectWs();
    await tick(20);
    expect(srv.ds.getConnectionCount()).toBe(2);

    ws1.close();
    await tick(50);
    expect(srv.ds.getConnectionCount()).toBe(1);

    ws2.close();
    await tick(50);
    expect(srv.ds.getConnectionCount()).toBe(0);
  });
});

describe('DatasoleServer — data channels', () => {
  it('createDataChannel and getDataChannel', async () => {
    srv = await createLiveTestServer();
    const ch = srv.ds.createDataChannel({
      key: 'live',
      pattern: 'server-live-state',
      granularity: 'immediate',
      initialValue: 0,
    });
    expect(ch).toBeDefined();
    expect(srv.ds.getDataChannel('live')).toBe(ch);
  });
});

describe('DatasoleServer — session', () => {
  it('set and get session value', async () => {
    srv = await createLiveTestServer();
    srv.ds.setSessionValue('user1', 'theme', 'dark');
    expect(srv.ds.getSessionValue('user1', 'theme')).toBe('dark');
    expect(srv.ds.getSessionValue('user1', 'missing')).toBeUndefined();
  });

  it('onSessionChange fires handler', async () => {
    srv = await createLiveTestServer();
    const handler = vi.fn();
    const unsub = srv.ds.onSessionChange(handler);
    srv.ds.setSessionValue('u1', 'lang', 'en');
    expect(handler).toHaveBeenCalledWith('u1', 'lang', 'en', expect.any(Number));
    unsub();
    srv.ds.setSessionValue('u1', 'lang', 'fr');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('DatasoleServer — getters', () => {
  it('getMetrics returns MetricsCollector', async () => {
    srv = await createLiveTestServer();
    expect(srv.ds.getMetrics()).toBeDefined();
  });

  it('getRateLimiter returns limiter', async () => {
    srv = await createLiveTestServer();
    expect(srv.ds.getRateLimiter()).toBeDefined();
  });

  it('getConcurrency returns strategy', async () => {
    srv = await createLiveTestServer();
    expect(srv.ds.getConcurrency()).toBeDefined();
  });
});

describe('DatasoleServer — close', () => {
  it('close clears connections, CRDTs, and sync channels', async () => {
    srv = await createLiveTestServer();
    srv.ds.registerCrdt('c', new PNCounter('s'));
    srv.ds.createSyncChannel({
      key: 'sc',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', batchIntervalMs: 100 },
    });

    const ws = await srv.connectWs();
    await tick(20);
    expect(srv.ds.getConnectionCount()).toBeGreaterThan(0);

    await srv.ds.close();

    expect(srv.ds.getConnectionCount()).toBe(0);
    expect(srv.ds.getCrdtState('c')).toBeUndefined();
    expect(srv.ds.getSyncChannel('sc')).toBeUndefined();
    ws.close();

    // Prevent afterEach from double-closing
    srv = undefined as unknown as LiveTestServer;
  });

  it('close is safe to call when no wsServer attached', async () => {
    const { DatasoleServer: DS } = await import('../../../src/server/server');
    const ds = new DS();
    await expect(ds.close()).resolves.toBeUndefined();
  });
});

describe('DatasoleServer — metrics increment on traffic', () => {
  it('increments messagesIn and messagesOut on RPC', async () => {
    srv = await createLiveTestServer();
    srv.ds.rpc('ping', async () => 'pong');

    const ws = await srv.connectWs();
    await rpc(ws, 'ping', null, 1);

    const snap = srv.ds.getMetrics().snapshot();
    expect(snap.messagesIn).toBeGreaterThanOrEqual(1);
    expect(snap.messagesOut).toBeGreaterThanOrEqual(1);
    ws.close();
  });
});

describe('DatasoleServer — multiple clients', () => {
  it('broadcasts state patches to all connected clients', async () => {
    srv = await createLiveTestServer();
    const clients: WebSocket[] = [];
    for (let i = 0; i < 3; i++) {
      clients.push(await srv.connectWs());
    }
    await tick(20);

    await srv.ds.setState('shared', { v: 1 });

    const promises = clients.map((ws) => receiveFrame(ws));
    await srv.ds.setState('shared', { v: 2 });
    const frames = await Promise.all(promises);

    for (const f of frames) {
      expect(f.opcode).toBe(Opcode.STATE_PATCH);
      expect((f.data as Record<string, unknown>).key).toBe('shared');
    }

    for (const ws of clients) ws.close();
  });
});
