import type { RpcCallOptions, RpcResult } from '../../shared/types';

export class RpcClient {
  private correlationCounter = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async call<TResult = unknown>(
    _method: string,
    _params?: unknown,
    _options?: RpcCallOptions,
  ): Promise<RpcResult<TResult>> {
    // TODO: encode RPC request frame, send via transport, await response by correlationId
    throw new Error('Not implemented');
  }

  nextCorrelationId(): number {
    return ++this.correlationCounter;
  }

  // TODO: resolve/reject pending calls when response frames arrive
}
