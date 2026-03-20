import { createServer, type Server } from 'http';

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { WsServer } from '../../../src/server/transport/ws-server';

let httpServer: Server;
let wsServer: WsServer;

function listenHttp(): Promise<number> {
  httpServer = createServer();
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

function connectWs(port: number, path = '/__ds'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}${path}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function connectWsRaw(port: number, path = '/__ds'): WebSocket {
  return new WebSocket(`ws://localhost:${port}${path}`);
}

afterEach(async () => {
  if (wsServer) await wsServer.stop();
  await new Promise<void>((resolve) => {
    if (httpServer) httpServer.close(() => resolve());
    else resolve();
  });
});

describe('WsServer (live)', () => {
  it('start creates WebSocketServer and accepts connections', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws = await connectWs(port);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('onConnection fires for each incoming WebSocket', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();

    const connected: string[] = [];
    wsServer.onConnection((_ws, info) => {
      connected.push(info.id);
    });

    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws1 = await connectWs(port);
    const ws2 = await connectWs(port);
    await new Promise((r) => setTimeout(r, 50));

    expect(connected.length).toBe(2);
    expect(connected[0]).toMatch(/^conn-/);
    expect(connected[1]).toMatch(/^conn-/);
    ws1.close();
    ws2.close();
  });

  it('setAuthHandler with successful auth passes auth result to onConnection', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    wsServer.setAuthHandler(async () => ({
      authenticated: true,
      userId: 'alice',
      roles: ['admin'],
    }));

    let authResult: unknown;
    wsServer.onConnection((_ws, info) => {
      authResult = info.auth;
    });

    await wsServer.start({ server: httpServer, path: '/__ds' });
    const ws = await connectWs(port);
    await new Promise((r) => setTimeout(r, 50));

    expect(authResult).toEqual(expect.objectContaining({ authenticated: true, userId: 'alice' }));
    ws.close();
  });

  it('setAuthHandler rejection sends 401 and destroys socket', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    wsServer.setAuthHandler(async () => ({ authenticated: false }));

    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws = connectWsRaw(port);
    const error = await new Promise<Error>((resolve) => {
      ws.on('error', resolve);
    });
    expect(error).toBeDefined();
  });

  it('auth handler exception sends 500 and destroys socket', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    wsServer.setAuthHandler(async () => {
      throw new Error('auth boom');
    });

    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws = connectWsRaw(port);
    const error = await new Promise<Error>((resolve) => {
      ws.on('error', resolve);
    });
    expect(error).toBeDefined();
  });

  it('wrong path destroys socket without upgrade', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws = connectWsRaw(port, '/wrong-path');
    const error = await new Promise<Error>((resolve) => {
      ws.on('error', resolve);
    });
    expect(error).toBeDefined();
  });

  it('getClientCount reflects connected clients', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    await wsServer.start({ server: httpServer, path: '/__ds' });

    expect(wsServer.getClientCount()).toBe(0);

    const ws1 = await connectWs(port);
    const ws2 = await connectWs(port);
    expect(wsServer.getClientCount()).toBe(2);

    ws1.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(wsServer.getClientCount()).toBe(1);

    ws2.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(wsServer.getClientCount()).toBe(0);
  });

  it('stop closes all connected clients', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();
    await wsServer.start({ server: httpServer, path: '/__ds' });

    const ws = await connectWs(port);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
    });

    await wsServer.stop();
    const closeCode = await closePromise;
    expect(closeCode).toBe(1001);
  });

  it('stop when not started is a no-op', async () => {
    wsServer = new WsServer();
    await expect(wsServer.stop()).resolves.toBeUndefined();
  });

  it('getClientCount returns 0 when not started', () => {
    wsServer = new WsServer();
    expect(wsServer.getClientCount()).toBe(0);
  });

  it('provides remoteAddress in connection info', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();

    let remoteAddr = '';
    wsServer.onConnection((_ws, info) => {
      remoteAddr = info.remoteAddress;
    });

    await wsServer.start({ server: httpServer, path: '/__ds' });
    const ws = await connectWs(port);
    await new Promise((r) => setTimeout(r, 50));

    expect(remoteAddr).toBeTruthy();
    ws.close();
  });

  it('binary messages pass through on connected WebSocket', async () => {
    const port = await listenHttp();
    wsServer = new WsServer();

    const messages: Uint8Array[] = [];
    wsServer.onConnection((ws) => {
      ws.on('message', (data: Buffer) => {
        messages.push(new Uint8Array(data));
        ws.send(data);
      });
    });

    await wsServer.start({ server: httpServer, path: '/__ds' });
    const ws = await connectWs(port);

    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    ws.send(payload);

    const echo = await new Promise<Uint8Array>((resolve) => {
      ws.on('message', (data: Buffer) => {
        resolve(new Uint8Array(data));
      });
    });
    expect(echo).toEqual(payload);
    expect(messages.length).toBe(1);
    ws.close();
  });
});
