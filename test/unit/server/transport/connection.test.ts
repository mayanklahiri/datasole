import { EventEmitter } from 'events';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

import { Connection } from '../../../../src/server/transport/connection';
import type { ConnectionInfo } from '../../../../src/server/transport/connection';

interface MockWs {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  _emitter: EventEmitter;
}

function createMockWs(readyState = 1): MockWs {
  const emitter = new EventEmitter();
  return {
    readyState,
    send: vi.fn((_data: unknown, cb?: (err?: Error) => void) => {
      cb?.();
    }),
    close: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
    }),
    _emitter: emitter,
  };
}

function asWs(mock: MockWs): WebSocket {
  return mock as unknown as WebSocket;
}

function createInfo(overrides?: Partial<ConnectionInfo>): ConnectionInfo {
  return {
    id: 'conn-1',
    remoteAddress: '127.0.0.1',
    connectedAt: Date.now(),
    auth: null,
    ...overrides,
  };
}

describe('Connection', () => {
  let ws: MockWs;
  let info: ConnectionInfo;

  beforeEach(() => {
    ws = createMockWs();
    info = createInfo();
  });

  describe('constructor', () => {
    it('stores info and creates context', () => {
      const conn = new Connection(info, asWs(ws));
      expect(conn.info).toBe(info);
      expect(conn.context.connectionId).toBe('conn-1');
      expect(conn.context.remoteAddress).toBe('127.0.0.1');
      expect(conn.context.auth).toBeNull();
    });

    it('works without a ws argument', () => {
      const conn = new Connection(info);
      expect(conn.info).toBe(info);
      expect(conn.isOpen()).toBe(false);
    });

    it('populates context with auth data', () => {
      const authedInfo = createInfo({
        auth: { userId: 'u1', roles: ['admin'], metadata: { org: 'acme' } },
      });
      const conn = new Connection(authedInfo, asWs(ws));
      expect(conn.context.userId).toBe('u1');
      expect(conn.context.auth?.roles).toEqual(['admin']);
    });
  });

  describe('send()', () => {
    it('calls ws.send with the data', async () => {
      const conn = new Connection(info, asWs(ws));
      const data = new Uint8Array([1, 2, 3]);
      await conn.send(data);
      expect(ws.send).toHaveBeenCalledWith(data, expect.any(Function));
    });

    it('throws when ws is not open', async () => {
      const closedWs = createMockWs(3);
      const conn = new Connection(info, asWs(closedWs));
      await expect(conn.send(new Uint8Array([1]))).rejects.toThrow('Connection not open');
    });

    it('throws when no ws provided', async () => {
      const conn = new Connection(info);
      await expect(conn.send(new Uint8Array([1]))).rejects.toThrow('Connection not open');
    });

    it('rejects when ws.send returns an error', async () => {
      const errWs = createMockWs();
      errWs.send.mockImplementation((_data: unknown, cb: (err?: Error) => void) => {
        cb(new Error('write failed'));
      });
      const conn = new Connection(info, asWs(errWs));
      await expect(conn.send(new Uint8Array([1]))).rejects.toThrow('write failed');
    });
  });

  describe('close()', () => {
    it('calls ws.close with default code 1000', () => {
      const conn = new Connection(info, asWs(ws));
      conn.close();
      expect(ws.close).toHaveBeenCalledWith(1000, undefined);
    });

    it('calls ws.close with custom code and reason', () => {
      const conn = new Connection(info, asWs(ws));
      conn.close(4001, 'rate limited');
      expect(ws.close).toHaveBeenCalledWith(4001, 'rate limited');
    });

    it('sets ws to null so isOpen returns false', () => {
      const conn = new Connection(info, asWs(ws));
      expect(conn.isOpen()).toBe(true);
      conn.close();
      expect(conn.isOpen()).toBe(false);
    });

    it('is safe to call without a ws', () => {
      const conn = new Connection(info);
      expect(() => conn.close()).not.toThrow();
    });
  });

  describe('isOpen()', () => {
    it('returns true when ws.readyState is 1 (OPEN)', () => {
      const conn = new Connection(info, asWs(ws));
      expect(conn.isOpen()).toBe(true);
    });

    it('returns false when ws.readyState is not 1', () => {
      const conn = new Connection(info, asWs(createMockWs(0)));
      expect(conn.isOpen()).toBe(false);
    });

    it('returns false when no ws', () => {
      const conn = new Connection(info);
      expect(conn.isOpen()).toBe(false);
    });
  });

  describe('onMessage()', () => {
    it('registers a message handler via ws.on', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onMessage(handler);
      expect(ws.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('handler receives Uint8Array from Buffer', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onMessage(handler);

      const buf = Buffer.from([10, 20, 30]);
      ws._emitter.emit('message', buf);

      expect(handler).toHaveBeenCalledOnce();
      const arg = handler.mock.calls[0]![0];
      expect(arg).toBeInstanceOf(Uint8Array);
      expect([...arg]).toEqual([10, 20, 30]);
    });

    it('handler receives Uint8Array from ArrayBuffer', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onMessage(handler);

      const ab = new ArrayBuffer(3);
      new Uint8Array(ab).set([4, 5, 6]);
      ws._emitter.emit('message', ab);

      expect(handler).toHaveBeenCalledOnce();
      const arg = handler.mock.calls[0]![0];
      expect([...arg]).toEqual([4, 5, 6]);
    });

    it('handler receives Uint8Array from Buffer[]', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onMessage(handler);

      const bufs = [Buffer.from([1, 2]), Buffer.from([3, 4])];
      ws._emitter.emit('message', bufs);

      expect(handler).toHaveBeenCalledOnce();
      const arg = handler.mock.calls[0]![0];
      expect([...arg]).toEqual([1, 2, 3, 4]);
    });

    it('does nothing when no ws', () => {
      const conn = new Connection(info);
      expect(() => conn.onMessage(vi.fn())).not.toThrow();
    });
  });

  describe('onClose()', () => {
    it('registers a close handler via ws.on', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onClose(handler);
      expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('handler receives code and reason string', () => {
      const conn = new Connection(info, asWs(ws));
      const handler = vi.fn();
      conn.onClose(handler);

      ws._emitter.emit('close', 1001, Buffer.from('going away'));

      expect(handler).toHaveBeenCalledWith(1001, 'going away');
    });

    it('does nothing when no ws', () => {
      const conn = new Connection(info);
      expect(() => conn.onClose(vi.fn())).not.toThrow();
    });
  });

  describe('info getter', () => {
    it('returns the ConnectionInfo passed to constructor', () => {
      const conn = new Connection(info, asWs(ws));
      expect(conn.info.id).toBe('conn-1');
      expect(conn.info.remoteAddress).toBe('127.0.0.1');
      expect(conn.info.auth).toBeNull();
    });
  });
});
