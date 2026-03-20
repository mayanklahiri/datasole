import type { Server as HttpServer } from 'http';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWss } = vi.hoisted(() => {
  const mockWss = {
    clients: new Set<{ close: ReturnType<typeof vi.fn> }>(),
    handleUpgrade: vi.fn(),
    close: vi.fn((cb: () => void) => cb()),
    on: vi.fn(),
  };
  return { mockWss };
});

vi.mock('ws', () => {
  function FakeWebSocketServer() {
    return mockWss;
  }
  return { WebSocketServer: FakeWebSocketServer };
});

import { WsServer } from '../../../src/server/transport/ws-server';

interface MockHttpServer {
  on: ReturnType<typeof vi.fn>;
  _listeners: Map<string, (...args: unknown[]) => void>;
}

type WsServerInternals = {
  wss: unknown;
  connectionHandler: unknown;
  authHandler: unknown;
};

function asHttp(mock: MockHttpServer): HttpServer {
  return mock as unknown as HttpServer;
}

function internals(ws: WsServer): WsServerInternals {
  return ws as unknown as WsServerInternals;
}

function makeHttpServer(): MockHttpServer {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
    _listeners: listeners,
  };
}

function makeSocket() {
  return {
    write: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeRequest(url = '/__ds', remoteAddress = '10.0.0.1') {
  return {
    url,
    headers: { host: 'localhost' },
    socket: { remoteAddress },
  };
}

describe('WsServer (mocked ws)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWss.clients.clear();
    mockWss.handleUpgrade.mockReset();
    mockWss.close.mockReset().mockImplementation((cb: () => void) => cb());
  });

  it('onConnection sets handler', () => {
    const ws = new WsServer();
    const handler = vi.fn();
    ws.onConnection(handler);
    expect(internals(ws).connectionHandler).toBe(handler);
  });

  it('setAuthHandler sets auth handler', () => {
    const ws = new WsServer();
    const handler = vi.fn();
    ws.setAuthHandler(handler);
    expect(internals(ws).authHandler).toBe(handler);
  });

  it('start creates WebSocketServer and registers upgrade handler', async () => {
    const ws = new WsServer();
    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    expect(internals(ws).wss).toBe(mockWss);
    expect(httpServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });

  it('stop closes all clients and wss, sets wss to null', async () => {
    const ws = new WsServer();
    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    const client1 = { close: vi.fn() };
    const client2 = { close: vi.fn() };
    mockWss.clients.add(client1);
    mockWss.clients.add(client2);

    await ws.stop();

    expect(client1.close).toHaveBeenCalledWith(1001, 'Server shutting down');
    expect(client2.close).toHaveBeenCalledWith(1001, 'Server shutting down');
    expect(mockWss.close).toHaveBeenCalled();
    expect(internals(ws).wss).toBeNull();
  });

  it('stop when not started is a no-op', async () => {
    const ws = new WsServer();
    await expect(ws.stop()).resolves.toBeUndefined();
  });

  it('getClientCount returns 0 when not started', () => {
    const ws = new WsServer();
    expect(ws.getClientCount()).toBe(0);
  });

  it('getClientCount returns clients.size when started', async () => {
    const ws = new WsServer();
    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    mockWss.clients.add({ close: vi.fn() });
    mockWss.clients.add({ close: vi.fn() });
    expect(ws.getClientCount()).toBe(2);
  });

  it('handleUpgrade with successful auth calls wss.handleUpgrade and fires connection handler', async () => {
    const ws = new WsServer();
    const connectionHandler = vi.fn();
    ws.onConnection(connectionHandler);
    ws.setAuthHandler(async () => ({ authenticated: true, userId: 'u1', roles: ['admin'] }));

    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    mockWss.handleUpgrade.mockImplementation(
      (_req: unknown, _socket: unknown, _head: unknown, cb: (ws: unknown) => void) => {
        cb({ fake: 'ws' });
      },
    );

    const upgradeHandler = httpServer._listeners.get('upgrade')!;
    const req = makeRequest('/__ds');
    const socket = makeSocket();
    const head = Buffer.alloc(0);

    upgradeHandler(req, socket, head);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockWss.handleUpgrade).toHaveBeenCalledWith(req, socket, head, expect.any(Function));
    expect(connectionHandler).toHaveBeenCalledWith(
      { fake: 'ws' },
      expect.objectContaining({
        id: expect.stringContaining('conn-'),
        remoteAddress: '10.0.0.1',
        auth: expect.objectContaining({ authenticated: true }),
      }),
    );
  });

  it('handleUpgrade with failed auth writes 401 and destroys socket', async () => {
    const ws = new WsServer();
    ws.setAuthHandler(async () => ({ authenticated: false }));

    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    const upgradeHandler = httpServer._listeners.get('upgrade')!;
    const req = makeRequest('/__ds');
    const socket = makeSocket();
    const head = Buffer.alloc(0);

    upgradeHandler(req, socket, head);
    await new Promise((r) => setTimeout(r, 10));

    expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
    expect(socket.destroy).toHaveBeenCalled();
    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
  });

  it('handleUpgrade with auth error writes 500 and destroys socket', async () => {
    const ws = new WsServer();
    ws.setAuthHandler(async () => {
      throw new Error('auth boom');
    });

    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    const upgradeHandler = httpServer._listeners.get('upgrade')!;
    const req = makeRequest('/__ds');
    const socket = makeSocket();
    const head = Buffer.alloc(0);

    upgradeHandler(req, socket, head);
    await new Promise((r) => setTimeout(r, 10));

    expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('upgrade request with wrong path destroys socket', async () => {
    const ws = new WsServer();
    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    const upgradeHandler = httpServer._listeners.get('upgrade')!;
    const req = makeRequest('/wrong-path');
    const socket = makeSocket();
    const head = Buffer.alloc(0);

    upgradeHandler(req, socket, head);
    await new Promise((r) => setTimeout(r, 10));

    expect(socket.destroy).toHaveBeenCalled();
    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
  });

  it('connection handler not called when none registered', async () => {
    const ws = new WsServer();
    ws.setAuthHandler(async () => ({ authenticated: true }));

    const httpServer = makeHttpServer();
    await ws.start({ server: asHttp(httpServer), path: '/__ds' });

    mockWss.handleUpgrade.mockImplementation(
      (_req: unknown, _socket: unknown, _head: unknown, cb: (ws: unknown) => void) => {
        cb({ fake: 'ws' });
      },
    );

    const upgradeHandler = httpServer._listeners.get('upgrade')!;
    upgradeHandler(makeRequest('/__ds'), makeSocket(), Buffer.alloc(0));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockWss.handleUpgrade).toHaveBeenCalled();
  });
});
