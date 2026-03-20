/**
 * Shared test helper: spins up a real DatasoleServer on a system-assigned port
 * with a plain Node.js HTTP server and provides utilities for raw WebSocket
 * frame send/receive via the `ws` library.
 */
import { createServer, type Server } from 'http';

import WebSocket from 'ws';

import { compress, decompress, deserialize, serialize } from '../../src/shared/codec';
import { COMPRESSION_THRESHOLD } from '../../src/shared/constants';
import { decodeFrame, encodeFrame, Opcode } from '../../src/shared/protocol';
import type { Frame } from '../../src/shared/protocol';
import { DatasoleServer, type DatasoleServerOptions } from '../../src/server/server';

export { Opcode };

export interface LiveTestServer {
  httpServer: Server;
  ds: DatasoleServer;
  port: number;
  url: string;
  wsUrl: string;
  connectWs(opts?: { path?: string; token?: string; query?: string }): Promise<WebSocket>;
  close(): Promise<void>;
}

export async function createLiveTestServer(
  options?: DatasoleServerOptions,
): Promise<LiveTestServer> {
  const httpServer = createServer();
  const ds = new DatasoleServer(options);
  ds.attach(httpServer);

  const port = await new Promise<number>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });

  const url = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${port}/__ds`;

  function connectWs(
    opts: { path?: string; token?: string; query?: string } = {},
  ): Promise<WebSocket> {
    const path = opts.path ?? '/__ds';
    const params = new URLSearchParams();
    if (opts.token) params.set('token', opts.token);
    if (opts.query) {
      for (const [k, v] of new URLSearchParams(opts.query)) params.set(k, v);
    }
    const qs = params.toString();
    const endpoint = `ws://localhost:${port}${path}${qs ? `?${qs}` : ''}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);
      ws.binaryType = 'arraybuffer';
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  async function close() {
    await ds.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  return { httpServer, ds, port, url, wsUrl, connectWs, close };
}

/** Build a binary frame ready to send over the wire (with compression). */
export function buildWireFrame(opcode: Opcode, correlationId: number, data: unknown): Uint8Array {
  const payload = serialize(data ?? null);
  let frame = encodeFrame({ opcode, correlationId, payload });
  if (frame.length > COMPRESSION_THRESHOLD) {
    frame = compress(frame);
  }
  return frame;
}

/** Send a typed frame over a raw WebSocket. */
export function sendFrame(
  ws: WebSocket,
  opcode: Opcode,
  correlationId: number,
  data: unknown,
): void {
  ws.send(buildWireFrame(opcode, correlationId, data));
}

/** Receive and decode the next binary frame from a raw WebSocket. */
export function receiveFrame(
  ws: WebSocket,
  timeoutMs = 5000,
): Promise<{ opcode: Opcode; correlationId: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeAllListeners('message');
      reject(new Error(`receiveFrame timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.once('message', (raw: Buffer | ArrayBuffer) => {
      clearTimeout(timer);
      try {
        let bytes = new Uint8Array(
          raw instanceof ArrayBuffer
            ? raw
            : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        );
        if (bytes.length > COMPRESSION_THRESHOLD) {
          bytes = decompress(bytes);
        }
        const frame = decodeFrame(bytes);
        resolve({
          opcode: frame.opcode,
          correlationId: frame.correlationId,
          data: deserialize(frame.payload),
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/** Collect N frames from a WebSocket, buffering them as they arrive. */
export function collectFrames(
  ws: WebSocket,
  count: number,
  timeoutMs = 5000,
): Promise<Array<{ opcode: Opcode; correlationId: number; data: unknown }>> {
  return new Promise((resolve, reject) => {
    const frames: Array<{ opcode: Opcode; correlationId: number; data: unknown }> = [];
    const timer = setTimeout(() => {
      ws.removeAllListeners('message');
      reject(
        new Error(`collectFrames timed out after ${timeoutMs}ms (got ${frames.length}/${count})`),
      );
    }, timeoutMs);

    const handler = (raw: Buffer | ArrayBuffer) => {
      try {
        let bytes = new Uint8Array(
          raw instanceof ArrayBuffer
            ? raw
            : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        );
        if (bytes.length > COMPRESSION_THRESHOLD) {
          bytes = decompress(bytes);
        }
        const frame = decodeFrame(bytes);
        frames.push({
          opcode: frame.opcode,
          correlationId: frame.correlationId,
          data: deserialize(frame.payload),
        });
        if (frames.length >= count) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(frames);
        }
      } catch (err) {
        clearTimeout(timer);
        ws.removeListener('message', handler);
        reject(err);
      }
    };

    ws.on('message', handler);
  });
}

/** Send an RPC request and return the response, handling correlation. */
export async function rpc(
  ws: WebSocket,
  method: string,
  params: unknown,
  correlationId: number,
  timeoutMs = 5000,
): Promise<{
  correlationId: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}> {
  sendFrame(ws, Opcode.RPC_REQ, correlationId, { method, params, correlationId });
  const resp = await receiveFrame(ws, timeoutMs);
  return resp.data as {
    correlationId: number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  };
}

/** Wait for a WebSocket to close, returning the close code and reason. */
export function waitForClose(
  ws: WebSocket,
  timeoutMs = 5000,
): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('waitForClose timed out')), timeoutMs);
    ws.once('close', (code: number, reason: Buffer) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

/** Small delay helper. */
export function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
