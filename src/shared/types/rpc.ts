/**
 * Shared RPC types: methods, requests, responses, and errors.
 */
export type RpcMethod = string;

export interface RpcRequest<T = unknown> {
  /** RPC method name. */
  method: RpcMethod;
  /** Request payload for the method. */
  params: T;
  /** Correlation id used to map responses to requests. */
  correlationId: number;
}

export interface RpcResponse<T = unknown> {
  /** Matches request correlation id. */
  correlationId: number;
  /** Successful result payload. */
  result?: T;
  /** Error payload if invocation failed. */
  error?: RpcError;
}

export interface RpcError {
  /** Error code (JSON-RPC style ranges are commonly used). */
  code: number;
  /** Human-readable error message. */
  message: string;
  /** Optional structured error metadata. */
  data?: unknown;
}

export interface RpcCallOptions {
  /** Request timeout in milliseconds. */
  timeout?: number;
}

export type RpcResult<T = unknown> = T;
