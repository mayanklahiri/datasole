/**
 * Framework-agnostic browser client: manages WebSocket connection, RPC, events, state subscriptions, and CRDT sync.
 */

import { compress, serialize } from '../shared/codec';
import { COMPRESSION_THRESHOLD, DEFAULT_WS_PATH } from '../shared/constants';
import type { CrdtState } from '../shared/crdt';
import { decodeFrame, encodeFrame, Opcode } from '../shared/protocol';
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

import { CrdtStore } from './crdt/crdt-store';
import { ClientEventEmitter } from './events/event-emitter';
import { RpcClient } from './rpc/rpc-client';
import { StateStore } from './state/state-store';
import { FallbackTransport } from './transport/fallback-transport';
import { MainThreadSharedBuffer } from './transport/shared-buffer';
import { WorkerProxy } from './transport/worker-proxy';
import { dispatchFrame } from './worker/message-handler';
import type { FrameRouter } from './worker/message-handler';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface DatasoleClientOptions {
  url: string;
  path?: string;
  auth?: AuthCredentials;
  useWorker?: boolean;
  workerUrl?: string;
  useSharedArrayBuffer?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class DatasoleClient {
  private state: ConnectionState = 'disconnected';
  private readonly options: Required<DatasoleClientOptions>;
  private transport: FallbackTransport | null = null;
  private workerProxy: WorkerProxy | null = null;
  private sharedBuffer: MainThreadSharedBuffer | null = null;
  private readonly rpcClient = new RpcClient();
  private readonly eventEmitter = new ClientEventEmitter();
  private readonly stateStores = new Map<string, StateStore<unknown>>();
  private crdtStore: CrdtStore | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DatasoleClientOptions) {
    this.options = {
      path: DEFAULT_WS_PATH,
      auth: {},
      useWorker: true,
      workerUrl: '/datasole-worker.iife.min.js',
      useSharedArrayBuffer: false,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  async connect(): Promise<void> {
    this.state = 'connecting';

    if (this.options.useWorker && typeof Worker !== 'undefined') {
      await this.connectViaWorker();
    } else {
      await this.connectDirect();
    }

    this.state = 'connected';
    this.reconnectAttempts = 0;
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rpcClient.clearPending();
    if (this.workerProxy) {
      await this.workerProxy.disconnect();
      this.workerProxy = null;
      this.sharedBuffer = null;
    }
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
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
    const payload = serialize({ event, data });

    if (this.transport) {
      this.transport.sendFrame({ opcode: Opcode.EVENT_C2S, correlationId: 0, payload });
    } else if (this.workerProxy) {
      let encoded = encodeFrame({ opcode: Opcode.EVENT_C2S, correlationId: 0, payload });
      if (encoded.length > COMPRESSION_THRESHOLD) encoded = compress(encoded);
      void this.workerProxy.send(encoded);
    } else {
      throw new Error('Not connected');
    }
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

  registerCrdt(nodeId: string): CrdtStore {
    this.crdtStore = new CrdtStore(nodeId);
    return this.crdtStore;
  }

  getCrdtStore(): CrdtStore | null {
    return this.crdtStore;
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

  private buildRouter(): FrameRouter {
    return {
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
      onCrdtState: (key, state) => {
        this.crdtStore?.mergeRemoteState(key, state as CrdtState);
      },
    };
  }

  private async connectDirect(): Promise<void> {
    this.transport = new FallbackTransport();
    const router = this.buildRouter();

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
      if (data.length > COMPRESSION_THRESHOLD) {
        this.transport?.send(compress(data));
      } else {
        this.transport?.send(data);
      }
    });

    const wsUrl = this.buildWsUrl();
    await this.transport.connect(wsUrl);
  }

  private async connectViaWorker(): Promise<void> {
    this.workerProxy = new WorkerProxy();
    const router = this.buildRouter();

    if (this.options.useSharedArrayBuffer) {
      const sab = new MainThreadSharedBuffer();
      if (sab.isAvailable()) {
        this.sharedBuffer = sab;
      }
    }

    this.workerProxy.on('message', (payload: unknown) => {
      dispatchFrame(payload as Frame, router);
    });

    this.workerProxy.on('sab-frame', () => {
      if (!this.sharedBuffer) return;
      let raw: Uint8Array | null;
      while ((raw = this.sharedBuffer.read()) !== null) {
        dispatchFrame(decodeFrame(raw), router);
      }
    });

    this.workerProxy.on('close', () => {
      this.state = 'disconnected';
      this.rpcClient.clearPending();
      if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.rpcClient.setSendFn((data) => {
      if (data.length > COMPRESSION_THRESHOLD) {
        void this.workerProxy?.send(compress(data));
      } else {
        void this.workerProxy?.send(data);
      }
    });

    const wsUrl = this.buildWsUrl();
    await this.workerProxy.connect(wsUrl, {
      workerUrl: this.options.workerUrl,
      useSharedArrayBuffer: this.options.useSharedArrayBuffer,
    });

    if (this.sharedBuffer) {
      const SAB_SIZE = 1024 * 1024;
      const buffer = this.sharedBuffer.create(SAB_SIZE);
      this.workerProxy.initSharedBuffer(buffer);
    }
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
