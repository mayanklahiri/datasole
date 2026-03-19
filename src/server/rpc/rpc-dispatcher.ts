import type { AuthContext, RpcRequest, RpcResponse } from '../../shared/types';
import type { ConnectionContext } from '../transport/connection-context';

export interface RpcContext {
  auth: AuthContext | null;
  connectionId: string;
  connection: ConnectionContext;
}

export type RpcHandler<TReq = unknown, TRes = unknown> = (
  params: TReq,
  ctx: RpcContext,
) => Promise<TRes>;

export class RpcDispatcher {
  private handlers = new Map<string, RpcHandler>();

  register<TReq = unknown, TRes = unknown>(method: string, handler: RpcHandler<TReq, TRes>): void {
    this.handlers.set(method, handler as RpcHandler);
  }

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
}
