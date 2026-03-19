export type RpcMethod = string;

export interface RpcRequest<T = unknown> {
  method: RpcMethod;
  params: T;
  correlationId: number;
}

export interface RpcResponse<T = unknown> {
  correlationId: number;
  result?: T;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcCallOptions {
  timeout?: number;
}

export type RpcResult<T = unknown> = T;
