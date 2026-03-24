import { describe, expect, it } from 'vitest';

import { StaticAssetServer } from '../../../../src/server/transport/static-assets';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  ended: boolean;
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
  end: (data?: Buffer) => void;
}

function createMockResponse(): MockResponse {
  return {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    ended: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(data) {
      this.ended = true;
      if (data) {
        this.body = data;
      }
    },
  };
}

describe('StaticAssetServer', () => {
  it('serves client runtime with cache headers', () => {
    const server = new StaticAssetServer('/__ds', {
      client: Buffer.from('client-body'),
      worker: Buffer.from('worker-body'),
    });
    const res = createMockResponse();

    const handled = server.handleRequest(
      {
        method: 'GET',
        url: '/__ds/datasole.iife.min.js',
        headers: { host: 'localhost' },
      } as never,
      res as never,
    );

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/javascript');
    expect(res.headers['ETag']).toBeDefined();
    expect(res.headers['Cache-Control']).toContain('immutable');
    expect(res.body.toString('utf8')).toBe('client-body');
  });

  it('returns 304 when if-none-match matches', () => {
    const server = new StaticAssetServer('/__ds', {
      client: Buffer.from('client-body'),
      worker: Buffer.from('worker-body'),
    });
    const prime = createMockResponse();

    server.handleRequest(
      {
        method: 'GET',
        url: '/__ds/datasole.iife.min.js',
        headers: { host: 'localhost' },
      } as never,
      prime as never,
    );

    const res = createMockResponse();
    const handled = server.handleRequest(
      {
        method: 'GET',
        url: '/__ds/datasole.iife.min.js',
        headers: { host: 'localhost', 'if-none-match': prime.headers['ETag'] },
      } as never,
      res as never,
    );

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(304);
    expect(res.body.length).toBe(0);
  });

  it('ignores unknown paths', () => {
    const server = new StaticAssetServer('/__ds', {
      client: Buffer.from('client-body'),
      worker: Buffer.from('worker-body'),
    });
    const res = createMockResponse();

    const handled = server.handleRequest(
      {
        method: 'GET',
        url: '/assets/app.js',
        headers: { host: 'localhost' },
      } as never,
      res as never,
    );

    expect(handled).toBe(false);
    expect(res.ended).toBe(false);
  });
});
