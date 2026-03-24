/**
 * Registers RPC method handlers, dispatches incoming requests with connection context, and surfaces errors to clients.
 */
import type { DatasoleContract } from '../../../shared/contract';
import type { RpcRequest, RpcResponse } from '../../../shared/types';
import type { ConnectionContext } from '../../transport/connection-context';
import type { RealtimePrimitive } from '../types';

export interface RpcContext {
  /** Auth payload resolved during upgrade, or null for anonymous connection. */
  auth: { userId?: string; roles?: string[]; metadata?: Record<string, unknown> } | null;
  /** Stable connection id assigned by transport. */
  connectionId: string;
  /** Mutable per-connection context bag. */
  connection: ConnectionContext;
}

export type RpcHandler<TReq = unknown, TRes = unknown> = (
  params: TReq,
  ctx: RpcContext,
) => Promise<TRes>;

export class RpcDispatcher<T extends DatasoleContract> implements RealtimePrimitive {
  private handlers = new Map<string, RpcHandler>();

  /** Register a typed RPC handler for a method key in the contract. */
  register<K extends keyof T['rpc'] & string>(
    method: K,
    handler: RpcHandler<T['rpc'][K]['params'], T['rpc'][K]['result']>,
  ): void {
    this.handlers.set(method, handler as RpcHandler);
  }

  /** Dispatch an RPC request to a registered handler and wrap result/errors. */
  async dispatch(request: RpcRequest, ctx: RpcContext): Promise<RpcResponse> {
    const handler = this.handlers.get(request.method);
    if (!handler) {
      return {
        correlationId: request.correlationId,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      };
    }
    try {
      const result = await handler(request.params, ctx);
      return { correlationId: request.correlationId, result };
    } catch (err) {
      return {
        correlationId: request.correlationId,
        error: { code: -32000, message: err instanceof Error ? err.message : 'Internal error' },
      };
    }
  }

  /** Clear all registered handlers. */
  async destroy(): Promise<void> {
    this.handlers.clear();
  }
}
