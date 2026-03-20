import { createServer, type Server as HttpServer } from 'http';

import { describe, it, expect, vi, afterEach } from 'vitest';

import { DatasoleNestAdapter } from '../../../../src/server/adapters/nestjs';

describe('DatasoleNestAdapter', () => {
  let server: HttpServer;
  let adapter: DatasoleNestAdapter;

  afterEach(() => {
    server?.close();
  });

  it('constructs', () => {
    adapter = new DatasoleNestAdapter();
    expect(adapter).toBeDefined();
  });

  it('attach and detach lifecycle', () => {
    adapter = new DatasoleNestAdapter();
    server = createServer();
    adapter.attach(server);
    adapter.detach();
  });

  it('create returns the attached server', () => {
    adapter = new DatasoleNestAdapter();
    server = createServer();
    adapter.attach(server);
    expect(adapter.create(3000)).toBe(server);
    adapter.detach();
  });

  it('create returns null when not attached', () => {
    adapter = new DatasoleNestAdapter();
    expect(adapter.create(3000)).toBeNull();
  });

  it('close detaches', () => {
    adapter = new DatasoleNestAdapter();
    server = createServer();
    adapter.attach(server);
    adapter.close(server);
  });

  describe('onUpgrade()', () => {
    it('registers upgrade handler on the server', () => {
      adapter = new DatasoleNestAdapter();
      server = createServer();
      adapter.attach(server);

      const handler = vi.fn();
      adapter.onUpgrade(handler);
      expect(server.listenerCount('upgrade')).toBe(1);

      adapter.detach();
    });

    it('throws when not attached to a server', () => {
      adapter = new DatasoleNestAdapter();
      expect(() => adapter.onUpgrade(vi.fn())).toThrow('not attached');
    });
  });

  describe('detach()', () => {
    it('removes the upgrade listener', () => {
      adapter = new DatasoleNestAdapter();
      server = createServer();
      adapter.attach(server);
      adapter.onUpgrade(vi.fn());
      expect(server.listenerCount('upgrade')).toBe(1);

      adapter.detach();
      expect(server.listenerCount('upgrade')).toBe(0);
    });

    it('is safe to call when not attached', () => {
      adapter = new DatasoleNestAdapter();
      expect(() => adapter.detach()).not.toThrow();
    });

    it('is safe to call without onUpgrade having been called', () => {
      adapter = new DatasoleNestAdapter();
      server = createServer();
      adapter.attach(server);
      expect(() => adapter.detach()).not.toThrow();
    });
  });

  describe('bindClientConnect()', () => {
    it('registers a connection listener on the server', () => {
      adapter = new DatasoleNestAdapter();
      server = createServer();
      adapter.attach(server);

      const before = server.listenerCount('connection');
      const callback = vi.fn();
      adapter.bindClientConnect(server, callback);
      expect(server.listenerCount('connection')).toBe(before + 1);

      adapter.detach();
    });

    it('does nothing when server is not attached', () => {
      adapter = new DatasoleNestAdapter();
      expect(() => adapter.bindClientConnect(null, vi.fn())).not.toThrow();
    });
  });

  describe('bindClientDisconnect()', () => {
    it('registers a close listener on the client socket', () => {
      adapter = new DatasoleNestAdapter();
      const mockSocket = { on: vi.fn() };
      const callback = vi.fn();

      adapter.bindClientDisconnect(mockSocket, callback);
      expect(mockSocket.on).toHaveBeenCalledWith('close', callback);
    });

    it('handles client without on method', () => {
      adapter = new DatasoleNestAdapter();
      expect(() => adapter.bindClientDisconnect({}, vi.fn())).not.toThrow();
    });
  });

  describe('bindMessageHandlers()', () => {
    it('is a no-op and does not throw', () => {
      adapter = new DatasoleNestAdapter();
      expect(() => adapter.bindMessageHandlers(null, [], vi.fn())).not.toThrow();
    });
  });
});
