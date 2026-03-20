import { describe, it, expect, vi } from 'vitest';

import type { RateLimiter, RateLimitRule } from '../../../src/server/rate-limit';
import { DatasoleServer } from '../../../src/server/server';
import { Connection } from '../../../src/server/transport/connection';
import { serialize, deserialize } from '../../../src/shared/codec';
import { PNCounter } from '../../../src/shared/crdt';
import type { CrdtOperation } from '../../../src/shared/crdt';
import { encodeFrame, decodeFrame, Opcode } from '../../../src/shared/protocol';

interface MockWs {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

type ServerInternals = {
  connections: Map<string, Connection>;
  handleIncomingFrame: (conn: Connection, frame: Uint8Array) => Promise<void>;
  getRateLimitKey: (connId: string, opcode: Opcode, payload: Uint8Array) => string;
  getRateLimitRule: (opcode: Opcode, payload: Uint8Array) => RateLimitRule;
  tryExtractMethod: (payload: Uint8Array) => string | undefined;
};

function internal(ds: DatasoleServer): ServerInternals {
  return ds as unknown as ServerInternals;
}

function getMockWs(conn: Connection): MockWs {
  return (conn as unknown as { ws: MockWs }).ws;
}

function makeFrame(opcode: Opcode, data: unknown, correlationId = 1): Uint8Array {
  return encodeFrame({ opcode, correlationId, payload: serialize(data) });
}

function makeConnection(id = 'test-conn'): Connection {
  const ws = {
    readyState: 1,
    send: vi.fn((_d: unknown, cb?: (err?: Error) => void) => cb?.()),
    close: vi.fn(),
    on: vi.fn(),
  };
  return new Connection(
    { id, remoteAddress: '127.0.0.1', connectedAt: Date.now(), auth: null },
    ws as never,
  );
}

function decodeWsSend(conn: Connection): { opcode: Opcode; correlationId: number; data: unknown } {
  const ws = getMockWs(conn);
  const call = ws.send.mock.calls[ws.send.mock.calls.length - 1] as [Uint8Array];
  const frame = decodeFrame(new Uint8Array(call[0]));
  return {
    opcode: frame.opcode,
    correlationId: frame.correlationId,
    data: deserialize(frame.payload),
  };
}

function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('DatasoleServer — handleIncomingFrame', () => {
  it('RPC_REQ dispatches to registered handler and sends RPC_RES', async () => {
    const ds = new DatasoleServer();
    ds.rpc('echo', async (params: unknown) => ({ echoed: (params as Record<string, unknown>).x }));
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const frame = makeFrame(Opcode.RPC_REQ, { method: 'echo', params: { x: 42 } }, 7);
    await internal(ds).handleIncomingFrame(conn, frame);
    await tick();

    const ws = getMockWs(conn);
    expect(ws.send).toHaveBeenCalled();
    const resp = decodeWsSend(conn);
    expect(resp.opcode).toBe(Opcode.RPC_RES);
    expect(resp.correlationId).toBe(7);
    expect((resp.data as Record<string, unknown>).result).toEqual({ echoed: 42 });

    await ds.close();
  });

  it('EVENT_C2S fires registered event handler', async () => {
    const ds = new DatasoleServer();
    const handler = vi.fn();
    ds.on('chat', handler);
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const frame = makeFrame(Opcode.EVENT_C2S, { event: 'chat', data: 'hi' }, 2);
    await internal(ds).handleIncomingFrame(conn, frame);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat', data: 'hi' }));

    await ds.close();
  });

  it('PING responds with PONG', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const frame = makeFrame(Opcode.PING, null, 99);
    await internal(ds).handleIncomingFrame(conn, frame);

    const resp = decodeWsSend(conn);
    expect(resp.opcode).toBe(Opcode.PONG);
    expect(resp.correlationId).toBe(99);

    await ds.close();
  });

  it('CRDT_OP applies operation and updates registry', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const frame = makeFrame(
      Opcode.CRDT_OP,
      {
        key: 'counter',
        op: {
          type: 'pn-counter',
          nodeId: 'c1',
          timestamp: Date.now(),
          op: 'increment',
          value: 1,
        },
      },
      3,
    );
    await internal(ds).handleIncomingFrame(conn, frame);

    const state = ds.getCrdtState('counter');
    expect(state).toBeDefined();
    expect(state!.type).toBe('pn-counter');
    expect(state!.value).toBe(1);

    await ds.close();
  });

  it('malformed frame does not throw', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const garbage = new Uint8Array([0xff, 0xfe, 0xab, 0x12]);
    await expect(internal(ds).handleIncomingFrame(conn, garbage)).resolves.toBeUndefined();

    await ds.close();
  });

  it('rate limit exceeded sends ERROR frame', async () => {
    const denyLimiter: RateLimiter = {
      check: async () => ({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 }),
      consume: async () => ({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 5000,
        retryAfter: 5000,
      }),
      reset: async () => {},
    };

    const ds = new DatasoleServer({ rateLimiter: denyLimiter });
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    const frame = makeFrame(Opcode.PING, null, 10);
    await internal(ds).handleIncomingFrame(conn, frame);

    const resp = decodeWsSend(conn);
    expect(resp.opcode).toBe(Opcode.ERROR);
    expect((resp.data as Record<string, unknown>).message).toBe('Rate limit exceeded');
    expect((resp.data as Record<string, unknown>).retryAfter).toBe(5000);

    await ds.close();
  });
});

describe('DatasoleServer — broadcastFrame', () => {
  it('broadcasts to all connections', async () => {
    const ds = new DatasoleServer();
    const conn1 = makeConnection('c1');
    const conn2 = makeConnection('c2');
    const conn3 = makeConnection('c3');
    internal(ds).connections.set('c1', conn1);
    internal(ds).connections.set('c2', conn2);
    internal(ds).connections.set('c3', conn3);

    ds.broadcast('test', { msg: 'hello' });

    for (const conn of [conn1, conn2, conn3]) {
      const ws = getMockWs(conn);
      expect(ws.send).toHaveBeenCalled();
      const resp = decodeWsSend(conn);
      expect(resp.opcode).toBe(Opcode.EVENT_S2C);
      expect((resp.data as Record<string, unknown>).event).toBe('test');
      expect((resp.data as Record<string, unknown>).data).toEqual({ msg: 'hello' });
    }

    await ds.close();
  });
});

describe('DatasoleServer — getRateLimitKey', () => {
  it('default returns connectionId:opcode', async () => {
    const ds = new DatasoleServer();
    const key = internal(ds).getRateLimitKey(
      'conn-1',
      Opcode.RPC_REQ,
      serialize({ method: 'foo' }),
    );
    expect(key).toBe(`conn-1:${Opcode.RPC_REQ}`);
    await ds.close();
  });

  it('custom keyExtractor is used', async () => {
    const ds = new DatasoleServer({
      rateLimit: {
        defaultRule: { windowMs: 60_000, maxRequests: 100 },
        keyExtractor: (connId, method) => `custom:${connId}:${method ?? 'none'}`,
      },
    });

    const key = internal(ds).getRateLimitKey(
      'conn-1',
      Opcode.RPC_REQ,
      serialize({ method: 'doStuff' }),
    );
    expect(key).toBe('custom:conn-1:doStuff');

    const keyNonRpc = internal(ds).getRateLimitKey('conn-2', Opcode.PING, serialize(null));
    expect(keyNonRpc).toBe('custom:conn-2:none');

    await ds.close();
  });
});

describe('DatasoleServer — getRateLimitRule', () => {
  it('returns default rule when no per-method rules configured', async () => {
    const ds = new DatasoleServer();
    const rule: RateLimitRule = internal(ds).getRateLimitRule(
      Opcode.RPC_REQ,
      serialize({ method: 'anything' }),
    );
    expect(rule.windowMs).toBe(60_000);
    expect(rule.maxRequests).toBe(100);
    await ds.close();
  });

  it('returns per-method rule for matching RPC method', async () => {
    const ds = new DatasoleServer({
      rateLimit: {
        defaultRule: { windowMs: 60_000, maxRequests: 100 },
        rules: { 'heavy.compute': { windowMs: 10_000, maxRequests: 5 } },
      },
    });

    const rule: RateLimitRule = internal(ds).getRateLimitRule(
      Opcode.RPC_REQ,
      serialize({ method: 'heavy.compute' }),
    );
    expect(rule.windowMs).toBe(10_000);
    expect(rule.maxRequests).toBe(5);

    const defaultRule: RateLimitRule = internal(ds).getRateLimitRule(
      Opcode.RPC_REQ,
      serialize({ method: 'other' }),
    );
    expect(defaultRule.maxRequests).toBe(100);

    await ds.close();
  });

  it('returns default rule for non-RPC opcodes even with per-method rules', async () => {
    const ds = new DatasoleServer({
      rateLimit: {
        defaultRule: { windowMs: 60_000, maxRequests: 100 },
        rules: { 'heavy.compute': { windowMs: 10_000, maxRequests: 5 } },
      },
    });

    const rule: RateLimitRule = internal(ds).getRateLimitRule(Opcode.PING, serialize(null));
    expect(rule.maxRequests).toBe(100);

    await ds.close();
  });
});

describe('DatasoleServer — tryExtractMethod', () => {
  it('extracts method from valid payload', async () => {
    const ds = new DatasoleServer();
    const method = internal(ds).tryExtractMethod(serialize({ method: 'myFunc' }));
    expect(method).toBe('myFunc');
    await ds.close();
  });

  it('returns undefined for payload without method field', async () => {
    const ds = new DatasoleServer();
    const method = internal(ds).tryExtractMethod(serialize({ foo: 'bar' }));
    expect(method).toBeUndefined();
    await ds.close();
  });

  it('returns undefined for malformed bytes', async () => {
    const ds = new DatasoleServer();
    const method = internal(ds).tryExtractMethod(new Uint8Array([0xff, 0xfe, 0x00]));
    expect(method).toBeUndefined();
    await ds.close();
  });
});

describe('DatasoleServer — state management', () => {
  it('setState and getState round-trip', async () => {
    const ds = new DatasoleServer();
    await ds.setState('key1', { foo: 'bar' });
    const val = await ds.getState('key1');
    expect(val).toEqual({ foo: 'bar' });
    await ds.close();
  });

  it('setState broadcasts STATE_PATCH to connections', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection('c1');
    internal(ds).connections.set('c1', conn);

    await ds.setState('obj', { a: 1 });
    const patches = await ds.setState('obj', { a: 2 });
    expect(patches.length).toBeGreaterThan(0);

    const ws = getMockWs(conn);
    expect(ws.send).toHaveBeenCalled();
    await ds.close();
  });

  it('setState uses sync channel when one exists', async () => {
    const ds = new DatasoleServer();
    const channel = ds.createSyncChannel({
      key: 'synced',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    expect(ds.getSyncChannel('synced')).toBe(channel);

    await ds.setState('synced', { a: 1 });
    await ds.setState('synced', { a: 2 });

    channel.destroy();
    await ds.close();
  });
});

describe('DatasoleServer — data channels', () => {
  it('createDataChannel and getDataChannel', async () => {
    const ds = new DatasoleServer();
    const ch = ds.createDataChannel({
      key: 'live',
      pattern: 'server-live-state',
      granularity: 'immediate',
      initialValue: 0,
    });
    expect(ch).toBeDefined();
    expect(ds.getDataChannel('live')).toBe(ch);
    await ds.close();
  });
});

describe('DatasoleServer — session', () => {
  it('set and get session value', async () => {
    const ds = new DatasoleServer();
    ds.setSessionValue('user1', 'theme', 'dark');
    expect(ds.getSessionValue('user1', 'theme')).toBe('dark');
    expect(ds.getSessionValue('user1', 'missing')).toBeUndefined();
    await ds.close();
  });

  it('onSessionChange fires handler', async () => {
    const ds = new DatasoleServer();
    const handler = vi.fn();
    const unsub = ds.onSessionChange(handler);

    ds.setSessionValue('u1', 'lang', 'en');
    expect(handler).toHaveBeenCalledWith('u1', 'lang', 'en', expect.any(Number));

    unsub();
    ds.setSessionValue('u1', 'lang', 'fr');
    expect(handler).toHaveBeenCalledTimes(1);
    await ds.close();
  });

  it('snapshotSession and restoreSession', async () => {
    const ds = new DatasoleServer();
    ds.setSessionValue('u2', 'k', 'v');

    const ctx = makeConnection('c1').context;
    (ctx as unknown as { userId: string }).userId = 'u2';

    const snap = await ds.snapshotSession(ctx);
    expect(snap).toBeDefined();

    const restored = await ds.restoreSession(ctx);
    expect(restored).toBeDefined();
    await ds.close();
  });
});

describe('DatasoleServer — CRDT operations', () => {
  it('applyCrdtOperation creates lww-register', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    ds.applyCrdtOperation('test-conn', {
      type: 'lww-register',
      nodeId: 'c1',
      timestamp: Date.now(),
      op: 'set',
      value: 'hello',
      key: 'reg1',
    });

    const state = ds.getCrdtState('reg1');
    expect(state).toBeDefined();
    expect(state!.type).toBe('lww-register');
    expect(state!.value).toBe('hello');
    await ds.close();
  });

  it('applyCrdtOperation creates lww-map', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    ds.applyCrdtOperation('test-conn', {
      type: 'lww-map',
      nodeId: 'c1',
      timestamp: Date.now(),
      op: 'set',
      key: 'map1',
      value: 42,
    } as unknown as CrdtOperation);

    const state = ds.getCrdtState('map1');
    expect(state).toBeDefined();
    expect(state!.type).toBe('lww-map');
    await ds.close();
  });

  it('applyCrdtOperation with unknown type is no-op', async () => {
    const ds = new DatasoleServer();
    ds.applyCrdtOperation('conn-x', {
      type: 'unknown-type' as unknown as CrdtOperation['type'],
      nodeId: 'c1',
      timestamp: Date.now(),
      op: 'set',
      value: 1,
      key: 'nope',
    });

    expect(ds.getCrdtState('nope')).toBeUndefined();
    await ds.close();
  });

  it('applyCrdtOperation uses connectionId as key when op.key is undefined', async () => {
    const ds = new DatasoleServer();
    const conn = makeConnection();
    internal(ds).connections.set('test-conn', conn);

    ds.applyCrdtOperation('test-conn', {
      type: 'pn-counter',
      nodeId: 'c1',
      timestamp: Date.now(),
      op: 'increment',
      value: 3,
    });

    const state = ds.getCrdtState('test-conn');
    expect(state).toBeDefined();
    expect(state!.value).toBe(3);
    await ds.close();
  });

  it('registerCrdt and getCrdtState', async () => {
    const ds = new DatasoleServer();
    const counter = new PNCounter('server');
    ds.registerCrdt('myCounter', counter);
    expect(ds.getCrdtState('myCounter')).toBeDefined();
    await ds.close();
  });

  it('getCrdtState returns undefined for unknown key', async () => {
    const ds = new DatasoleServer();
    expect(ds.getCrdtState('nonexistent')).toBeUndefined();
    await ds.close();
  });
});

describe('DatasoleServer — events', () => {
  it('off removes handler', async () => {
    const ds = new DatasoleServer();
    const handler = vi.fn();
    ds.on('ev', handler);
    ds.off('ev', handler);
    ds.broadcast('ev', 'data');
    expect(handler).not.toHaveBeenCalled();
    await ds.close();
  });
});

describe('DatasoleServer — getters', () => {
  it('getMetrics returns MetricsCollector', async () => {
    const ds = new DatasoleServer();
    expect(ds.getMetrics()).toBeDefined();
    await ds.close();
  });

  it('getRateLimiter returns limiter', async () => {
    const ds = new DatasoleServer();
    expect(ds.getRateLimiter()).toBeDefined();
    await ds.close();
  });

  it('getConcurrency returns strategy', async () => {
    const ds = new DatasoleServer();
    expect(ds.getConcurrency()).toBeDefined();
    await ds.close();
  });

  it('getConnectionCount returns map size', async () => {
    const ds = new DatasoleServer();
    expect(ds.getConnectionCount()).toBe(0);
    internal(ds).connections.set('a', makeConnection('a'));
    expect(ds.getConnectionCount()).toBe(1);
    await ds.close();
  });
});

describe('DatasoleServer — close', () => {
  it('close clears connections, CRDTs, and sync channels', async () => {
    const ds = new DatasoleServer();
    internal(ds).connections.set('a', makeConnection('a'));
    ds.registerCrdt('c', new PNCounter('s'));
    ds.createSyncChannel({
      key: 'sc',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', batchIntervalMs: 100 },
    });

    await ds.close();

    expect(ds.getConnectionCount()).toBe(0);
    expect(ds.getCrdtState('c')).toBeUndefined();
    expect(ds.getSyncChannel('sc')).toBeUndefined();
  });

  it('close is safe to call when no wsServer attached', async () => {
    const ds = new DatasoleServer();
    await expect(ds.close()).resolves.toBeUndefined();
  });
});
