import { createServer } from 'http';
import type { AddressInfo } from 'net';

import { describe, it, expect } from 'vitest';
import WebSocket from 'ws';

import { WsServer } from '../../../src/server/transport/ws-server';

const WS_PATH = '/ds-ws-test';

describe('WsServer', () => {
  it('constructs', () => {
    expect(new WsServer()).toBeInstanceOf(WsServer);
  });

  it('getClientCount returns 0 before start', () => {
    const s = new WsServer();
    expect(s.getClientCount()).toBe(0);
  });

  it('start accepts upgrade, connection handler fires, stop cleans up', async () => {
    const httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, resolve);
    });
    const { port } = httpServer.address() as AddressInfo;

    const wsServer = new WsServer();
    let sawConnection = false;
    wsServer.onConnection(() => {
      sawConnection = true;
    });
    await wsServer.start({ server: httpServer, path: WS_PATH });

    const ws = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });

    expect(sawConnection).toBe(true);
    expect(wsServer.getClientCount()).toBeGreaterThanOrEqual(1);

    await new Promise<void>((resolve, reject) => {
      ws.once('close', () => resolve());
      ws.once('error', reject);
      void ws.close();
    });

    await wsServer.stop();
    expect(wsServer.getClientCount()).toBe(0);

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
