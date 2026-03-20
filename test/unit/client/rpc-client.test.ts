import { describe, it, expect, vi, afterEach } from 'vitest';

import { RpcClient } from '../../../src/client/rpc/rpc-client';
import { deserialize } from '../../../src/shared/codec';
import { decodeFrame, Opcode } from '../../../src/shared/protocol';

describe('RpcClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when no sendFn', async () => {
    const c = new RpcClient();
    await expect(c.call('m')).rejects.toThrow(/not connected/);
  });

  it('call sends RPC_REQ frame with serialized request', async () => {
    const c = new RpcClient();
    const sent: Uint8Array[] = [];
    c.setSendFn((d) => sent.push(d));
    const p = c.call('hello', { a: 1 });
    expect(sent).toHaveLength(1);
    const frame = decodeFrame(sent[0]!);
    expect(frame.opcode).toBe(Opcode.RPC_REQ);
    const req: { method: string; params: unknown; correlationId: number } = deserialize(
      frame.payload,
    );
    expect(req.method).toBe('hello');
    expect(req.params).toEqual({ a: 1 });
    expect(req.correlationId).toBe(frame.correlationId);
    c.handleResponse(req.correlationId, { correlationId: req.correlationId, result: 'ok' });
    await expect(p).resolves.toBe('ok');
  });

  it('handleResponse resolves pending call', async () => {
    const c = new RpcClient();
    c.setSendFn(() => {});
    const p = c.call('x', null);
    c.handleResponse(1, { correlationId: 1, result: 42 });
    await expect(p).resolves.toBe(42);
  });

  it('timeout rejects', async () => {
    vi.useFakeTimers();
    const c = new RpcClient();
    c.setSendFn(() => {});
    const p = c.call('slow', null, { timeout: 100 });
    const rejected = expect(p).rejects.toThrow(/timeout/);
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it('clearPending rejects all pending', async () => {
    const c = new RpcClient();
    c.setSendFn(() => {});
    const a = c.call('a', null);
    const b = c.call('b', null);
    c.clearPending();
    await expect(a).rejects.toThrow(/closed/);
    await expect(b).rejects.toThrow(/closed/);
  });
});
