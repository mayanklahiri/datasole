import { describe, it, expect } from 'vitest';

import { RpcDispatcher } from '../../../src/server/primitives/rpc/rpc-dispatcher';
import type { RpcContext } from '../../../src/server/primitives/rpc/rpc-dispatcher';
import type { ConnectionContext } from '../../../src/server/transport/connection-context';
import type { RpcRequest } from '../../../src/shared/types';
import { TestRpc, type TestContract } from '../../helpers/test-contract';

function mockCtx(): RpcContext {
  const connection = {} as ConnectionContext;
  return {
    auth: null,
    connectionId: 'c1',
    connection,
  };
}

describe('RpcDispatcher', () => {
  it('register + dispatch returns result', async () => {
    const d = new RpcDispatcher<TestContract>();
    d.register(TestRpc.Add, async (params) => ({ sum: params.a + params.b }));
    const req: RpcRequest = { method: TestRpc.Add, params: { a: 2, b: 3 }, correlationId: 10 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.correlationId).toBe(10);
    expect(res.result).toEqual({ sum: 5 });
    expect(res.error).toBeUndefined();
  });

  it('unknown method returns JSON-RPC method not found (-32601)', async () => {
    const d = new RpcDispatcher<TestContract>();
    const req: RpcRequest = { method: '__rpc_unknown__', params: null, correlationId: 1 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.error?.code).toBe(-32601);
    expect(res.error?.message).toMatch(/not found/);
  });

  it('handler exception returns -32000 with message', async () => {
    const d = new RpcDispatcher<TestContract>();
    d.register(TestRpc.Boom, async () => {
      throw new Error('kaboom');
    });
    const req: RpcRequest = { method: TestRpc.Boom, params: null, correlationId: 2 };
    const res = await d.dispatch(req, mockCtx());
    expect(res.error?.code).toBe(-32000);
    expect(res.error?.message).toBe('kaboom');
  });

  it('concurrent dispatches resolve independently', async () => {
    const d = new RpcDispatcher<TestContract>();
    d.register(TestRpc.Slow, async (params) => {
      const p = params as { ms: number; v: number };
      await new Promise((r) => setTimeout(r, p.ms));
      return p.v;
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
