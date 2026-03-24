import { request } from 'http';

import { afterEach, describe, expect, it } from 'vitest';

import { createLiveTestServer, type LiveTestServer } from '../../helpers/live-server';
import type { TestContract } from '../../helpers/test-contract';

let srv: LiveTestServer<TestContract> | null = null;

afterEach(async () => {
  if (srv) {
    await srv.close();
    srv = null;
  }
});

function get(
  pathname: string,
  etag?: string,
): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: 'localhost',
        port: srv!.port,
        path: pathname,
        method: 'GET',
        headers: etag ? { 'If-None-Match': etag } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('server runtime asset serving', () => {
  it('serves client and worker runtime at configured path with cache headers', async () => {
    srv = await createLiveTestServer<TestContract>({ path: '/__ds' });

    const clientRes = await get('/__ds/datasole.iife.min.js');
    expect(clientRes.statusCode).toBe(200);
    expect(clientRes.headers['content-type']).toContain('application/javascript');
    expect(clientRes.headers['etag']).toBeTruthy();
    expect(clientRes.headers['cache-control']).toContain('immutable');
    expect(clientRes.body.length).toBeGreaterThan(0);

    const workerRes = await get('/__ds/datasole-worker.iife.min.js');
    expect(workerRes.statusCode).toBe(200);
    expect(workerRes.headers['content-type']).toContain('application/javascript');
    expect(workerRes.headers['etag']).toBeTruthy();
    expect(workerRes.body.length).toBeGreaterThan(0);
  });

  it('returns 304 when if-none-match matches', async () => {
    srv = await createLiveTestServer<TestContract>({ path: '/__ds' });

    const first = await get('/__ds/datasole.iife.min.js');
    const etag = first.headers['etag'];
    expect(typeof etag).toBe('string');

    const second = await get('/__ds/datasole.iife.min.js', etag as string);
    expect(second.statusCode).toBe(304);
    expect(second.body.length).toBe(0);
  });
});
