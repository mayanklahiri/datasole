import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FallbackTransport } from '../../../src/client/transport/fallback-transport';

let mockWsInstance: InstanceType<typeof MockWebSocket>;

function storeMockWs(instance: InstanceType<typeof MockWebSocket>): void {
  mockWsInstance = instance;
}

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static readonly CONNECTING = 0;
  static readonly CLOSING = 2;

  readonly OPEN = 1;
  readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly CLOSING = 2;

  binaryType = '';
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    storeMockWs(this);
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function connectTransport(
  transport: FallbackTransport,
  url = 'ws://localhost:3000/__ds',
): Promise<void> {
  const p = transport.connect(url);
  mockWsInstance.onopen!({});
  return p;
}

describe('FallbackTransport', () => {
  describe('connect', () => {
    it('creates a WebSocket with the given URL', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);
      expect(mockWsInstance.url).toBe('ws://localhost:3000/__ds');
    });

    it('sets binaryType to arraybuffer', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);
      expect(mockWsInstance.binaryType).toBe('arraybuffer');
    });

    it('rejects on WebSocket error', async () => {
      const transport = new FallbackTransport();
      const p = transport.connect('ws://localhost:3000/__ds');
      mockWsInstance.onerror!({});
      await expect(p).rejects.toThrow('WebSocket connection failed');
    });

    it('calls onOpen handler when connected', async () => {
      const transport = new FallbackTransport();
      const onOpen = vi.fn();
      transport.onOpen(onOpen);
      await connectTransport(transport);
      expect(onOpen).toHaveBeenCalledOnce();
    });
  });

  describe('send', () => {
    it('calls ws.send with the data', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);

      const data = new Uint8Array([1, 2, 3]);
      transport.send(data);
      expect(mockWsInstance.send).toHaveBeenCalledWith(data);
    });

    it('throws when not connected', () => {
      const transport = new FallbackTransport();
      expect(() => transport.send(new Uint8Array([1]))).toThrow('WebSocket not connected');
    });

    it('throws when WebSocket is not in OPEN state', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);

      mockWsInstance.readyState = MockWebSocket.CLOSED;
      expect(() => transport.send(new Uint8Array([1]))).toThrow('WebSocket not connected');
    });
  });

  describe('disconnect', () => {
    it('calls ws.close', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);

      await transport.disconnect();
      expect(mockWsInstance.close).toHaveBeenCalledOnce();
    });

    it('sets ws to null after disconnect', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('is safe when not connected', async () => {
      const transport = new FallbackTransport();
      await expect(transport.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('onMessage', () => {
    it('registers a message handler that receives decoded frames', async () => {
      const transport = new FallbackTransport();
      const handler = vi.fn();
      transport.onMessage(handler);

      await connectTransport(transport);

      const { encodeFrame, Opcode } = await import('../../../src/shared/protocol');
      const frame = encodeFrame({
        opcode: Opcode.EVENT_S2C,
        correlationId: 0,
        payload: new Uint8Array([10, 20]),
      });

      mockWsInstance.onmessage!({ data: frame.buffer as ArrayBuffer });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0].opcode).toBe(Opcode.EVENT_S2C);
    });
  });

  describe('onClose', () => {
    it('registers a close handler that receives code and reason', async () => {
      const transport = new FallbackTransport();
      const handler = vi.fn();
      transport.onClose(handler);

      await connectTransport(transport);

      mockWsInstance.onclose!({ code: 1000, reason: 'Normal' });
      expect(handler).toHaveBeenCalledWith(1000, 'Normal');
    });
  });

  describe('onError', () => {
    it('registers an error handler', async () => {
      const transport = new FallbackTransport();
      const handler = vi.fn();
      transport.onError(handler);

      const p = transport.connect('ws://localhost:3000/__ds');
      mockWsInstance.onerror!({});

      await expect(p).rejects.toThrow();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', () => {
      const transport = new FallbackTransport();
      expect(transport.isConnected()).toBe(false);
    });

    it('returns true when WebSocket is OPEN', async () => {
      const transport = new FallbackTransport();
      await connectTransport(transport);
      expect(transport.isConnected()).toBe(true);
    });
  });
});
