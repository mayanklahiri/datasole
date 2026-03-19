import { describe, it, expect } from 'vitest';

import { RpcDispatcher } from '../../../src/server/rpc/rpc-dispatcher';
import type { ConnectionContext } from '../../../src/server/transport/connection-context';
import type { RpcRequest } from '../../../src/shared/types';

function mockCtx(): import('../../../src/server/rpc/rpc-dispatcher').RpcContext {
  const connection = {} as ConnectionContext;
  return {
    auth: null,
    connectionId: 'c1',
    connection,
  };
}

describe('RpcDispatcher', () => {
  it('register + dispatch returns result', async () => {
    const d = new RpcDispatcher();
    d.register('add', async (params: { a: number; b: number }) => params.a + params.b);
    const req: RpcRequest = { method: 'add', params: { a: 2, b: 3 }, correlationId: 10 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.correlationId).toBe(10);
    expect(res.result).toBe(5);
    expect(res.error).toBeUndefined();
  });

  it('unknown method returns JSON-RPC method not found (-32601)', async () => {
    const d = new RpcDispatcher();
    const req: RpcRequest = { method: 'nope', params: null, correlationId: 1 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.error?.code).toBe(-32601);
    expect(res.error?.message).toMatch(/not found/);
  });

  it('handler exception returns -32000 with message', async () => {
    const d = new RpcDispatcher();
    d.register('boom', async () => {
      throw new Error('kaboom');
    });
    const req: RpcRequest = { method: 'boom', params: null, correlationId: 2 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.error?.code).toBe(-32000);
    expect(res.error?.message).toBe('kaboom');
  });

  it('concurrent dispatches resolve independently', async () => {
    const d = new RpcDispatcher();
    d.register('slow', async (params: { ms: number; v: number }) => {
      await new Promise((r) => setTimeout(r, params.ms));
      return params.v;
    });
    const ctx = mockCtx();
    const [ra, rb] = await Promise.all([
      d.dispatch({ method: 'slow', params: { ms: 20, v: 1 }, correlationId: 1 }, ctx),
      d.dispatch({ method: 'slow', params: { ms: 5, v: 2 }, correlationId: 2 }, ctx),
    ]);
    expect(ra.result).toBe(1);
    expect(rb.result).toBe(2);
  });
});
