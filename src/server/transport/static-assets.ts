import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';

interface StaticAsset {
  readonly body: Buffer;
  readonly etag: string;
}
interface StaticAssetBytes {
  readonly client?: Buffer;
  readonly worker?: Buffer;
}

function normalizeBasePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

function loadAsset(fileName: string): StaticAsset | null {
  const candidates = [
    resolve(process.cwd(), 'dist/client', fileName),
    resolve(process.cwd(), '../../dist/client', fileName),
    resolve(process.cwd(), '../../../dist/client', fileName),
    resolve(process.cwd(), '../../../../dist/client', fileName),
    resolve(process.cwd(), '../../../../../dist/client', fileName),
    resolve(process.cwd(), 'node_modules/datasole/dist/client', fileName),
    resolve(process.cwd(), '../node_modules/datasole/dist/client', fileName),
    resolve(process.cwd(), '../../node_modules/datasole/dist/client', fileName),
    resolve(process.cwd(), '../../../node_modules/datasole/dist/client', fileName),
    resolve(process.cwd(), '../../../../node_modules/datasole/dist/client', fileName),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const body = readFileSync(filePath);
    const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 24)}"`;
    return { body, etag };
  }

  return null;
}

/**
 * Serves datasole browser runtime assets with immutable caching + ETag support.
 */
export class StaticAssetServer {
  private readonly clientAsset: StaticAsset | null;
  private readonly workerAsset: StaticAsset | null;
  private readonly clientPath: string;
  private readonly workerPath: string;

  constructor(path: string, assets?: StaticAssetBytes) {
    const basePath = normalizeBasePath(path);
    this.clientPath = `${basePath}/datasole.iife.min.js`;
    this.workerPath = `${basePath}/datasole-worker.iife.min.js`;
    this.clientAsset = assets?.client
      ? {
          body: assets.client,
          etag: `"${createHash('sha256').update(assets.client).digest('hex').slice(0, 24)}"`,
        }
      : loadAsset('datasole.iife.min.js');
    this.workerAsset = assets?.worker
      ? {
          body: assets.worker,
          etag: `"${createHash('sha256').update(assets.worker).digest('hex').slice(0, 24)}"`,
        }
      : loadAsset('datasole-worker.iife.min.js');
  }

  handleRequest(req: IncomingMessage, res: ServerResponse): boolean {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      return false;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname === this.clientPath && this.clientAsset) {
      this.sendAsset(this.clientAsset, req, res);
      return true;
    }
    if (url.pathname === this.workerPath && this.workerAsset) {
      this.sendAsset(this.workerAsset, req, res);
      return true;
    }
    return false;
  }

  private sendAsset(asset: StaticAsset, req: IncomingMessage, res: ServerResponse): void {
    if (req.headers['if-none-match'] === asset.etag) {
      res.writeHead(304, {
        ETag: asset.etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'same-origin',
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': String(asset.body.length),
      ETag: asset.etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(asset.body);
  }
}
