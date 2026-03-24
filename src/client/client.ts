/**
 * Framework-agnostic browser client: manages WebSocket connection, RPC, events, state subscriptions, and CRDT sync.
 */

import { compress, serialize } from '../shared/codec';
import { COMPRESSION_THRESHOLD, DEFAULT_WS_PATH } from '../shared/constants';
import type { DatasoleContract, EventData, StateValue } from '../shared/contract';
import type { CrdtState } from '../shared/crdt';
import { decodeFrame, encodeFrame, Opcode } from '../shared/protocol';
import type { Frame } from '../shared/protocol';
import type {
  AuthCredentials,
  EventPayload,
  RpcCallOptions,
  RpcResponse,
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
  /** Base server URL, e.g. `ws://localhost:3000` or `http://localhost:3000`. */
  url: string;
  /** Datasole endpoint path mounted on the server. @default '/__ds' */
  path?: string;
  /** Optional authentication payload sent during connection setup. */
  auth?: AuthCredentials;
  /** Run WebSocket transport in a dedicated Web Worker. @default true */
  useWorker?: boolean;
  /** Worker script URL. Defaults to `${path}/datasole-worker.iife.min.js`. */
  workerUrl?: string;
  /** Enable SharedArrayBuffer zero-copy bridge when available. @default false */
  useSharedArrayBuffer?: boolean;
  /** Automatically reconnect after disconnects. @default true */
  reconnect?: boolean;
  /** Base reconnect interval in milliseconds. @default 1000 */
  reconnectInterval?: number;
  /** Maximum reconnect attempts before giving up. @default 10 */
  maxReconnectAttempts?: number;
}

/**
 * Browser-side realtime client facade.
 *
 * Responsibilities:
 * - manages WebSocket lifecycle (`connect`/`disconnect`)
 * - multiplexes typed RPC calls over one socket
 * - routes event/state/CRDT frames to local stores and handlers
 * - handles optional worker transport and reconnect backoff
 *
 * @remarks
 * **Layering (outside-in):** URL/options → {@link FallbackTransport} or {@link WorkerProxy} +
 * {@link MainThreadSharedBuffer} → frame codec in the worker or main thread → {@link RpcClient},
 * {@link ClientEventEmitter}, per-key {@link StateStore}, optional {@link CrdtStore}. Public
 * methods stay thin; stores and RPC own protocol details.
 */
export class DatasoleClient<T extends DatasoleContract> {
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
    const path = options.path ?? DEFAULT_WS_PATH;
    this.options = {
      path,
      auth: {},
      useWorker: true,
      workerUrl: `${path}/datasole-worker.iife.min.js`,
      useSharedArrayBuffer: false,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  /** Establish the transport connection and start frame routing. */
  async connect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.disposeTransport();

    this.state = 'connecting';

    if (this.options.useWorker && typeof Worker !== 'undefined') {
      await this.connectViaWorker();
    } else {
      await this.connectDirect();
    }

    this.state = 'connected';
    this.reconnectAttempts = 0;
  }

  /** Gracefully disconnect and clear all pending RPC calls/timers. */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.disposeTransport();
    this.state = 'disconnected';
  }

  /** Close worker/WebSocket transport without changing `this.state` (used before reconnect). */
  private async disposeTransport(): Promise<void> {
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
  }

  /** Get the current connection lifecycle state. */
  getConnectionState(): ConnectionState {
    return this.state;
  }

  /** Call a typed RPC method registered on the server. */
  async rpc<K extends keyof T['rpc'] & string>(
    method: K,
    params?: T['rpc'][K]['params'],
    options?: RpcCallOptions,
  ): Promise<T['rpc'][K]['result']> {
    return this.rpcClient.call<T['rpc'][K]['result']>(method, params, options);
  }

  /** Subscribe to a typed server-to-client event. */
  on<K extends keyof T['events'] & string>(
    event: K,
    handler: (payload: EventPayload<EventData<T, K>>) => void,
  ): void {
    this.eventEmitter.on(event, handler as (payload: EventPayload) => void);
  }

  /** Unsubscribe an event handler registered with `on`. */
  off<K extends keyof T['events'] & string>(
    event: K,
    handler: (payload: EventPayload<EventData<T, K>>) => void,
  ): void {
    this.eventEmitter.off(event, handler as (payload: EventPayload) => void);
  }

  /** Emit a typed client-to-server event. */
  emit<K extends keyof T['events'] & string>(event: K, data?: EventData<T, K>): void {
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

  /** Subscribe to a typed state key synchronized from the server. */
  subscribeState<K extends keyof T['state'] & string>(
    key: K,
    handler: (state: StateValue<T, K>) => void,
  ): StateSubscription {
    if (!this.stateStores.has(key)) {
      this.stateStores.set(key, new StateStore<unknown>(undefined));
    }
    const store = this.stateStores.get(key)!;
    return store.subscribe(handler as (state: unknown) => void);
  }

  /** Read the latest known value for a synchronized state key. */
  getState<K extends keyof T['state'] & string>(key: K): StateValue<T, K> | undefined {
    const store = this.stateStores.get(key);
    return store?.getState() as StateValue<T, K> | undefined;
  }

  /** Register a CRDT store bound to this client connection. */
  registerCrdt(nodeId: string): CrdtStore {
    this.crdtStore = new CrdtStore(nodeId);
    return this.crdtStore;
  }

  /** Return the active CRDT store, if one was registered. */
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
        if (!this.stateStores.has(key)) {
          this.stateStores.set(key, new StateStore<unknown>(undefined));
        }
        this.stateStores.get(key)!.applyPatches(patches as StatePatch[]);
      },
      onStateSnapshot: (key, data) => {
        if (!this.stateStores.has(key)) {
          this.stateStores.set(key, new StateStore<unknown>(undefined));
        }
        this.stateStores.get(key)!.applyPatches([{ op: 'replace', path: '', value: data }]);
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
    const base = this.options.reconnectInterval;
    const exp = Math.min(2 ** this.reconnectAttempts, 64);
    const jitter = Math.random() * base;
    const delay = base * exp + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}
