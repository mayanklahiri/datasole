import { serialize } from '../shared/codec';
import { DEFAULT_WS_PATH } from '../shared/constants';
import { encodeFrame, Opcode } from '../shared/protocol';
import type { Frame } from '../shared/protocol';
import type {
  AuthCredentials,
  EventHandler,
  RpcCallOptions,
  RpcResponse,
  RpcResult,
  StatePatch,
  StateSubscription,
} from '../shared/types';

import { ClientEventEmitter } from './events/event-emitter';
import { RpcClient } from './rpc/rpc-client';
import { StateStore } from './state/state-store';
import { FallbackTransport } from './transport/fallback-transport';
import { dispatchFrame } from './worker/message-handler';
import type { FrameRouter } from './worker/message-handler';

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
  private transport: FallbackTransport | null = null;
  private readonly rpcClient = new RpcClient();
  private readonly eventEmitter = new ClientEventEmitter();
  private readonly stateStores = new Map<string, StateStore<unknown>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DatasoleClientOptions) {
    this.options = {
      path: DEFAULT_WS_PATH,
      auth: {},
      useWorker: false,
      useSharedArrayBuffer: false,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  async connect(): Promise<void> {
    this.state = 'connecting';
    this.transport = new FallbackTransport();

    const router: FrameRouter = {
      onRpcResponse: (correlationId, payload) => {
        this.rpcClient.handleResponse(correlationId, payload as RpcResponse);
      },
      onEvent: (event, data, _timestamp) => {
        this.eventEmitter.emit(event, data);
      },
      onStatePatch: (key, patches) => {
        const store = this.stateStores.get(key);
        store?.applyPatches(patches as StatePatch[]);
      },
      onStateSnapshot: (key, data) => {
        const store = this.stateStores.get(key);
        if (store) {
          store.applyPatches([{ op: 'replace', path: '', value: data }]);
        }
      },
    };

    this.transport.onMessage((frame: Frame) => {
      dispatchFrame(frame, router);
    });

    this.transport.onClose((_code, _reason) => {
      this.state = 'disconnected';
      this.rpcClient.clearPending();
      if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.rpcClient.setSendFn((data) => {
      this.transport?.send(data);
    });

    const wsUrl = this.buildWsUrl();
    await this.transport.connect(wsUrl);
    this.state = 'connected';
    this.reconnectAttempts = 0;
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rpcClient.clearPending();
    await this.transport?.disconnect();
    this.transport = null;
    this.state = 'disconnected';
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  async rpc<TResult = unknown>(
    method: string,
    params?: unknown,
    options?: RpcCallOptions,
  ): Promise<RpcResult<TResult>> {
    return this.rpcClient.call<TResult>(method, params, options);
  }

  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.eventEmitter.on(event, handler);
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.eventEmitter.off(event, handler);
  }

  emit(event: string, data?: unknown): void {
    if (!this.transport) throw new Error('Not connected');
    const payload = serialize({ event, data });
    const encoded = encodeFrame({ opcode: Opcode.EVENT_C2S, correlationId: 0, payload });
    this.transport.send(encoded);
  }

  subscribeState<T = unknown>(key: string, handler: (state: T) => void): StateSubscription {
    if (!this.stateStores.has(key)) {
      this.stateStores.set(key, new StateStore<unknown>(undefined));
    }
    const store = this.stateStores.get(key)!;
    return store.subscribe(handler as (state: unknown) => void);
  }

  getState<T = unknown>(key: string): T | undefined {
    const store = this.stateStores.get(key);
    return store?.getState() as T | undefined;
  }

  private buildWsUrl(): string {
    const base = this.options.url.replace(/^http/, 'ws');
    const path = this.options.path;
    const url = base.endsWith('/') ? `${base.slice(0, -1)}${path}` : `${base}${path}`;

    const params = new URLSearchParams();
    if (this.options.auth.token) {
      params.set('token', this.options.auth.token);
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}
