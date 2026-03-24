/**
 * E2E security tests: exercises attack vectors against a live server.
 */
import { expect, test } from '@playwright/test';
import { createServer } from 'http';
import { WebSocket } from 'ws';

import { DatasoleServer } from '../../../src/server/server';
import { MemoryBackend } from '../../../src/server/backends/memory';
import { compress } from '../../../src/shared/codec/compression';
import { encodeFrame, FRAME_HEADER_SIZE, Opcode } from '../../../src/shared/protocol';
import { serialize } from '../../../src/shared/codec/serialization';
import { ServerHarness } from '../helpers/server-harness';
import { TestRpc, type TestContract } from '../../helpers/test-contract';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

function connectRawWs(port: number, path = '/__ds'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.binaryType = 'arraybuffer';
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test.describe('Security', () => {
  test.describe.configure({ timeout: 30000 });

  test('malformed frames do not crash the server', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 5000 });

    const port = parseInt(new URL(harness.getUrl()).port);
    const ws = await connectRawWs(port);

    // Send garbage bytes
    ws.send(new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]));
    // Send truncated frame header
    ws.send(new Uint8Array(4));
    // Send frame with invalid opcode
    const invalidOpcode = new Uint8Array(FRAME_HEADER_SIZE);
    invalidOpcode[0] = 0xcc;
    ws.send(invalidOpcode);

    await new Promise((r) => setTimeout(r, 500));
    ws.close();

    // Server still works after receiving garbage
    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected', undefined, {
      timeout: 5000,
    });
    const result = await page.evaluate(() => window.__rpc('echo', { alive: true }));
    expect(result).toEqual({ alive: true });
  });

  test('oversized event name is silently dropped', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 5000 });
    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected', undefined, {
      timeout: 5000,
    });

    // Emit event with an absurdly long name — should not crash the server
    await page.evaluate(() => {
      const longName = 'x'.repeat(1000);
      const client = window.__client as { emit: (e: string, d: unknown) => void } | null;
      client?.emit(longName, { test: true });
    });

    await new Promise((r) => setTimeout(r, 300));

    // Server is still alive
    const result = await page.evaluate(() => window.__rpc('echo', { still: 'alive' }));
    expect(result).toEqual({ still: 'alive' });
  });

  test('RPC with unknown method returns error', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 5000 });
    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected', undefined, {
      timeout: 5000,
    });

    await expect(page.evaluate(() => window.__rpc('nonexistent_method', {}))).rejects.toThrow(
      /Method not found/,
    );
  });

  test('connection limit works', async () => {
    const httpServer = createServer();
    const ds = new DatasoleServer<TestContract>({
      stateBackend: new MemoryBackend(),
      maxConnections: 2,
    });
    ds.rpc.register(TestRpc.Ping, async () => 'pong');
    ds.attach(httpServer);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const ws1 = await connectRawWs(port);
    const ws2 = await connectRawWs(port);

    // Third connection should be rejected
    const ws3ClosePromise = new Promise<number>((resolve) => {
      const ws3 = new WebSocket(`ws://127.0.0.1:${port}/__ds`);
      ws3.on('close', (code) => resolve(code));
      ws3.on('error', () => {});
    });
    const closeCode = await ws3ClosePromise;
    expect(closeCode).toBe(1013);

    ws1.close();
    ws2.close();
    await ds.close();
    httpServer.close();
  });

  test('auth handler exception denies access', async () => {
    const httpServer = createServer();
    const ds = new DatasoleServer<TestContract>({
      stateBackend: new MemoryBackend(),
      authHandler: async () => {
        throw new Error('Auth service down');
      },
    });
    ds.attach(httpServer);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const rejection = new Promise<string>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/__ds`);
      ws.on('unexpected-response', (_req, res) => {
        resolve(`${res.statusCode}`);
      });
      ws.on('error', () => {});
    });
    const status = await rejection;
    expect(status).toBe('500');

    await ds.close();
    httpServer.close();
  });
});
