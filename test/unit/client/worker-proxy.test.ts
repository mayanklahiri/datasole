import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkerProxy } from '../../../src/client/transport/worker-proxy';

let mockWorkerInstance: InstanceType<typeof MockWorker>;
let messageListeners: ((event: { data: unknown }) => void)[];

function storeMockWorker(instance: InstanceType<typeof MockWorker>): void {
  mockWorkerInstance = instance;
}

class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  removeEventListener = vi.fn();

  constructor(public scriptUrl: string) {
    storeMockWorker(this);
  }

  addEventListener(type: string, handler: (event: { data: unknown }) => void): void {
    if (type === 'message') messageListeners.push(handler);
  }
}

beforeEach(() => {
  messageListeners = [];
  vi.stubGlobal('Worker', MockWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function simulateWorkerMessage(data: unknown): void {
  for (const listener of messageListeners) {
    listener({ data });
  }
}

function connectProxy(proxy: WorkerProxy, url = 'ws://localhost:3000/__ds'): Promise<void> {
  const p = proxy.connect(url);
  simulateWorkerMessage({ type: 'open' });
  return p;
}

describe('WorkerProxy', () => {
  it('constructs without error and exposes expected API', () => {
    const p = new WorkerProxy();
    expect(typeof p.connect).toBe('function');
    expect(typeof p.send).toBe('function');
    expect(typeof p.disconnect).toBe('function');
    expect(typeof p.on).toBe('function');
    expect(typeof p.off).toBe('function');
  });

  describe('on / off', () => {
    it('on registers handler that receives dispatched messages', async () => {
      const proxy = new WorkerProxy();
      const handler = vi.fn();
      proxy.on('message', handler);
      await connectProxy(proxy);

      simulateWorkerMessage({ type: 'message', payload: { test: true } });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ test: true });
    });

    it('off removes handler so it no longer receives messages', async () => {
      const proxy = new WorkerProxy();
      const handler = vi.fn();
      proxy.on('message', handler);
      await connectProxy(proxy);

      proxy.off('message', handler);
      simulateWorkerMessage({ type: 'message', payload: { test: true } });

      expect(handler).not.toHaveBeenCalled();
    });

    it('off on non-existent event does not throw', () => {
      const p = new WorkerProxy();
      expect(() => p.off('nonexistent', vi.fn())).not.toThrow();
    });
  });

  describe('connect', () => {
    it('creates a Worker and posts connect message', async () => {
      const proxy = new WorkerProxy();
      await connectProxy(proxy);

      expect(mockWorkerInstance.scriptUrl).toBe('/__ds/datasole-worker.iife.min.js');
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        type: 'connect',
        payload: { url: 'ws://localhost:3000/__ds' },
      });
    });

    it('resolves when worker sends open message', async () => {
      const proxy = new WorkerProxy();
      await expect(connectProxy(proxy)).resolves.toBeUndefined();
    });

    it('rejects when worker sends error message', async () => {
      const proxy = new WorkerProxy();
      const p = proxy.connect('ws://localhost:3000/__ds');
      simulateWorkerMessage({ type: 'error' });
      await expect(p).rejects.toThrow('WebSocket connection failed in worker');
    });

    it('uses custom workerUrl from options', async () => {
      const proxy = new WorkerProxy();
      const p = proxy.connect('ws://localhost:3000/__ds', {
        workerUrl: '/custom-worker.js',
      });
      simulateWorkerMessage({ type: 'open' });
      await p;

      expect(mockWorkerInstance.scriptUrl).toBe('/custom-worker.js');
    });

    it('rejects when Worker constructor throws', async () => {
      vi.stubGlobal(
        'Worker',
        class {
          constructor() {
            throw new Error('Worker unsupported');
          }
        },
      );
      const proxy = new WorkerProxy();
      await expect(proxy.connect('ws://localhost:3000/__ds')).rejects.toThrow(
        'Failed to create Worker',
      );
    });
  });

  describe('send', () => {
    it('posts send message with data and transfers buffer', async () => {
      const proxy = new WorkerProxy();
      await connectProxy(proxy);

      const data = new Uint8Array([1, 2, 3]);
      const bufferRef = data.buffer;
      await proxy.send(data);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
        { type: 'send', payload: { data } },
        [bufferRef],
      );
    });

    it('throws when worker not initialized', async () => {
      const proxy = new WorkerProxy();
      await expect(proxy.send(new Uint8Array([1]))).rejects.toThrow('Worker not initialized');
    });
  });

  describe('disconnect', () => {
    it('posts disconnect message and terminates worker', async () => {
      const proxy = new WorkerProxy();
      await connectProxy(proxy);

      await proxy.disconnect();

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ type: 'disconnect' });
      expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce();
    });

    it('subsequent send rejects after disconnect', async () => {
      const proxy = new WorkerProxy();
      await connectProxy(proxy);
      await proxy.disconnect();

      await expect(proxy.send(new Uint8Array([1]))).rejects.toThrow('Worker not initialized');
    });

    it('is safe when worker is already null', async () => {
      const proxy = new WorkerProxy();
      await expect(proxy.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('initSharedBuffer', () => {
    it('posts init-sab message with buffer', async () => {
      const proxy = new WorkerProxy();
      await connectProxy(proxy);

      const sab = new SharedArrayBuffer(1024);
      proxy.initSharedBuffer(sab);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        type: 'init-sab',
        payload: { buffer: sab },
      });
    });

    it('throws when worker not initialized', () => {
      const proxy = new WorkerProxy();
      expect(() => proxy.initSharedBuffer(new SharedArrayBuffer(1024))).toThrow(
        'Worker not initialized',
      );
    });
  });

  describe('message dispatching', () => {
    it('dispatches messages to registered listeners by type', async () => {
      const proxy = new WorkerProxy();
      const handler = vi.fn();
      proxy.on('message', handler);

      await connectProxy(proxy);

      simulateWorkerMessage({ type: 'message', payload: { foo: 'bar' } });
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('dispatches close events to listeners', async () => {
      const proxy = new WorkerProxy();
      const handler = vi.fn();
      proxy.on('close', handler);

      await connectProxy(proxy);

      simulateWorkerMessage({ type: 'close', payload: undefined });
      expect(handler).toHaveBeenCalled();
    });
  });
});
