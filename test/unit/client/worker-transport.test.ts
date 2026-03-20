import { describe, expect, it } from 'vitest';

import { WorkerProxy } from '../../../src/client/transport/worker-proxy';

describe('WorkerProxy', () => {
  it('constructs without errors', () => {
    const proxy = new WorkerProxy();
    expect(proxy).toBeDefined();
  });

  it('send throws when worker not initialized', async () => {
    const proxy = new WorkerProxy();
    await expect(proxy.send(new Uint8Array([1]))).rejects.toThrow('Worker not initialized');
  });

  it('disconnect when not connected is safe', async () => {
    const proxy = new WorkerProxy();
    await proxy.disconnect();
  });

  it('on/off manage listeners', () => {
    const proxy = new WorkerProxy();
    const handler = () => {};
    proxy.on('test', handler);
    proxy.off('test', handler);
  });

  it('initSharedBuffer throws when worker not initialized', () => {
    const proxy = new WorkerProxy();
    const sab = new SharedArrayBuffer(64);
    expect(() => proxy.initSharedBuffer(sab)).toThrow('Worker not initialized');
  });
});
