/**
 * Client-side RPC: sends requests with correlation IDs, tracks pending calls, resolves responses.
 */

import { serialize } from '../../shared/codec';
import { encodeFrame, Opcode } from '../../shared/protocol';
import type { RpcCallOptions, RpcRequest, RpcResponse, RpcResult } from '../../shared/types';

export type SendFn = (data: Uint8Array) => void;

export class RpcClient {
  private correlationCounter = 0;
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer?: ReturnType<typeof setTimeout>;
    }
  >();
  private sendFn: SendFn | null = null;

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  async call<TResult = unknown>(
    method: string,
    params?: unknown,
    options?: RpcCallOptions,
  ): Promise<RpcResult<TResult>> {
    if (!this.sendFn) throw new Error('Transport not connected');

    const correlationId = this.nextCorrelationId();
    const request: RpcRequest = { method, params: params ?? null, correlationId };
    const payload = serialize(request);
    const frame = encodeFrame({ opcode: Opcode.RPC_REQ, correlationId, payload });

    return new Promise<RpcResult<TResult>>((resolve, reject) => {
      const timeout = options?.timeout ?? 30000;
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`RPC timeout: ${method} (${timeout}ms)`));
      }, timeout);

      this.pending.set(correlationId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.sendFn!(frame);
    });
  }

  handleResponse(correlationId: number, response: RpcResponse): void {
    const entry = this.pending.get(correlationId);
    if (!entry) return;
    this.pending.delete(correlationId);
    if (entry.timer) clearTimeout(entry.timer);

    if (response.error) {
      entry.reject(new Error(response.error.message));
    } else {
      entry.resolve(response.result);
    }
  }

  nextCorrelationId(): number {
    return ++this.correlationCounter;
  }

  clearPending(): void {
    for (const [, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(new Error('Connection closed'));
    }
    this.pending.clear();
  }
}
