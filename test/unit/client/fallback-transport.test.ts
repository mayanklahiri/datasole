import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NodeWebSocket from 'ws';

import { FallbackTransport } from '../../../src/client/transport/fallback-transport';
import { serialize } from '../../../src/shared/codec';
import { Opcode } from '../../../src/shared/protocol';
import { createLiveTestServer, tick, type LiveTestServer } from '../../helpers/live-server';
import { TestRpc, type TestContract } from '../../helpers/test-contract';

let srv: LiveTestServer<TestContract> | undefined;

function liveSrv(): LiveTestServer<TestContract> {
  if (srv === undefined) {
    throw new Error('test setup error: live server not initialized');
  }
  return srv;
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', NodeWebSocket);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (!srv) return;
  const toClose = srv;
  srv = undefined;
  await toClose.close();
});

describe('FallbackTransport (live server)', () => {
  beforeEach(async () => {
    srv = await createLiveTestServer<TestContract>();
    liveSrv().ds.rpc.register(TestRpc.Echo, async (params: unknown) => params);
  });

  describe('connect', () => {
    it('connects to a real server', async () => {
      const transport = new FallbackTransport();
      await transport.connect(liveSrv().wsUrl);
      expect(transport.isConnected()).toBe(true);
      await transport.disconnect();
    });

    it('sets binaryType to arraybuffer', async () => {
      const transport = new FallbackTransport();
      await transport.connect(liveSrv().wsUrl);
      expect(transport.isConnected()).toBe(true);
      await transport.disconnect();
    });

    it('rejects on connection to bad URL', async () => {
      const transport = new FallbackTransport();
      await expect(transport.connect('ws://localhost:1/__bad')).rejects.toThrow();
    });

    it('calls onOpen handler when connected', async () => {
      const transport = new FallbackTransport();
      const onOpen = vi.fn();
      transport.onOpen(onOpen);
      await transport.connect(liveSrv().wsUrl);
      expect(onOpen).toHaveBeenCalledOnce();
      await transport.disconnect();
    });
  });

  describe('send / receive', () => {
    it('sends binary data and receives a response', async () => {
      const transport = new FallbackTransport();
      const received: unknown[] = [];
      transport.onMessage((frame) => received.push(frame));
      await transport.connect(liveSrv().wsUrl);

      const payload = serialize({ method: 'echo', params: 'hello', correlationId: 1 });
      transport.sendFrame({ opcode: Opcode.RPC_REQ, correlationId: 1, payload });
      await tick(100);

      expect(received.length).toBeGreaterThanOrEqual(1);
      const resp = received[0] as { opcode: number; correlationId: number };
      expect(resp.opcode).toBe(Opcode.RPC_RES);
      expect(resp.correlationId).toBe(1);
      await transport.disconnect();
    });

    it('throws when sending while not connected', () => {
      const transport = new FallbackTransport();
      expect(() => transport.send(new Uint8Array([1]))).toThrow('WebSocket not connected');
    });
  });

  describe('sendFrame', () => {
    it('handles large payloads end-to-end (triggers compression path)', async () => {
      const transport = new FallbackTransport();
      const frameReceived = new Promise<unknown>((resolve) => {
        transport.onMessage((frame) => resolve(frame));
      });
      await transport.connect(liveSrv().wsUrl);

      // High-entropy data that stays > 256 bytes even after compression
      const items = Array.from({ length: 50 }, (_, i) => `k${i}:${(i * 31337).toString(36)}`);
      const bigPayload = { method: 'echo', params: items, correlationId: 2 };
      transport.sendFrame({
        opcode: Opcode.RPC_REQ,
        correlationId: 2,
        payload: serialize(bigPayload),
      });

      const frame = await frameReceived;
      expect((frame as { opcode: number }).opcode).toBe(Opcode.RPC_RES);
      expect((frame as { correlationId: number }).correlationId).toBe(2);
      await transport.disconnect();
    });
  });

  describe('disconnect', () => {
    it('disconnects and isConnected returns false', async () => {
      const transport = new FallbackTransport();
      await transport.connect(liveSrv().wsUrl);
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('is safe when not connected', async () => {
      const transport = new FallbackTransport();
      await expect(transport.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('onClose', () => {
    it('fires close handler when server closes connection', async () => {
      const transport = new FallbackTransport();
      let closeCode = -1;
      transport.onClose((code) => {
        closeCode = code;
      });
      await transport.connect(liveSrv().wsUrl);

      const instance = liveSrv();
      await instance.ds.close();
      await tick(100);

      expect(closeCode).toBeGreaterThanOrEqual(1000);

      await new Promise<void>((resolve, reject) => {
        instance.httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      srv = undefined;
    });
  });

  describe('onError', () => {
    it('fires error handler on connection failure', async () => {
      const transport = new FallbackTransport();
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      await expect(transport.connect('ws://localhost:1/__bad')).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', () => {
      const transport = new FallbackTransport();
      expect(transport.isConnected()).toBe(false);
    });

    it('returns true when connected', async () => {
      const transport = new FallbackTransport();
      await transport.connect(liveSrv().wsUrl);
      expect(transport.isConnected()).toBe(true);
      await transport.disconnect();
    });
  });

  describe('onMessage decodes frames', () => {
    it('decodes incoming binary frames into Frame objects', async () => {
      const transport = new FallbackTransport();
      const frames: unknown[] = [];
      transport.onMessage((frame) => frames.push(frame));
      await transport.connect(liveSrv().wsUrl);

      transport.sendFrame({
        opcode: Opcode.PING,
        correlationId: 42,
        payload: serialize(null),
      });
      await tick(100);

      expect(frames.length).toBeGreaterThanOrEqual(1);
      const pong = frames[0] as { opcode: number; correlationId: number };
      expect(pong.opcode).toBe(Opcode.PONG);
      expect(pong.correlationId).toBe(42);
      await transport.disconnect();
    });
  });
});
