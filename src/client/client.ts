import { DEFAULT_WS_PATH } from '../shared/constants';
import type { AuthCredentials, EventHandler, RpcCallOptions, RpcResult, StateSubscription } from '../shared/types';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface DatasoleClientOptions {
  url: string;
  path?: string;
  auth?: AuthCredentials;
  useWorker?: boolean;
  useSharedArrayBuffer?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class DatasoleClient {
  private state: ConnectionState = 'disconnected';
  private readonly options: Required<DatasoleClientOptions>;

  constructor(options: DatasoleClientOptions) {
    this.options = {
      path: DEFAULT_WS_PATH,
      auth: {},
      useWorker: true,
      useSharedArrayBuffer: true,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  async connect(): Promise<void> {
    this.state = 'connecting';
    // TODO: initialize transport (worker or fallback), connect WebSocket
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected';
    // TODO: close transport
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  async rpc<TResult = unknown>(
    _method: string,
    _params?: unknown,
    _options?: RpcCallOptions,
  ): Promise<RpcResult<TResult>> {
    // TODO: delegate to RpcClient
    throw new Error('Not implemented');
  }

  on<T = unknown>(_event: string, _handler: EventHandler<T>): void {
    // TODO: delegate to ClientEventEmitter
  }

  off<T = unknown>(_event: string, _handler: EventHandler<T>): void {
    // TODO: delegate to ClientEventEmitter
  }

  emit(_event: string, _data?: unknown): void {
    // TODO: send event via transport
  }

  subscribeState<T = unknown>(_key: string, _handler: (state: T) => void): StateSubscription {
    // TODO: delegate to StateStore
    return { unsubscribe: () => {} };
  }

  getState<T = unknown>(_key: string): T | undefined {
    // TODO: delegate to StateStore
    return undefined;
  }
}
