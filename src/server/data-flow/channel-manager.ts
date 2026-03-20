/**
 * Manages DataChannel lifecycle: creates channels from LiveStateConfig and wires the appropriate server subsystems.
 */
import type {
  DataFlowPattern,
  LiveStateConfig,
  DataChannel,
  SyncGranularity,
} from '../../shared/types/data-flow';
import type { SyncChannelConfig, FlushStrategy, SyncDirection, SyncMode } from '../sync/types';

export interface ChannelManagerDeps {
  createSyncChannel: (config: SyncChannelConfig) => void;
  registerEventHandler: (event: string, handler: (data: unknown) => void) => void;
  registerCrdt: (key: string, type: string) => void;
}

class ManagedChannel implements DataChannel {
  active = true;
  private destroyFn: () => void;

  constructor(
    readonly pattern: DataFlowPattern,
    readonly key: string,
    destroyFn: () => void,
  ) {
    this.destroyFn = destroyFn;
  }

  close(): void {
    this.active = false;
    this.destroyFn();
  }
}

function granularityToFlushStrategy(g: SyncGranularity): FlushStrategy {
  switch (g) {
    case 'immediate':
      return 'immediate';
    case 'batched':
      return 'batched';
    case 'debounced':
      return 'debounced';
    case 'manual':
      return 'immediate';
  }
}

function patternToDirection(p: DataFlowPattern): SyncDirection {
  switch (p) {
    case 'server-live-state':
    case 'server-event':
      return 'server-to-client';
    case 'client-live-state':
    case 'client-event':
      return 'client-to-server';
    case 'bidirectional-event':
    case 'bidirectional-crdt':
      return 'bidirectional';
    default:
      return 'server-to-client';
  }
}

function patternToSyncMode(p: DataFlowPattern): SyncMode {
  switch (p) {
    case 'bidirectional-crdt':
      return 'crdt';
    case 'server-live-state':
    case 'client-live-state':
      return 'json-patch';
    default:
      return 'snapshot';
  }
}

export class ChannelManager {
  private channels = new Map<string, ManagedChannel>();

  constructor(private deps: ChannelManagerDeps) {}

  create<T>(config: LiveStateConfig<T>): DataChannel {
    if (this.channels.has(config.key)) {
      return this.channels.get(config.key)!;
    }

    switch (config.pattern) {
      case 'rpc':
        return this.createRpcChannel(config);
      case 'server-event':
      case 'client-event':
      case 'bidirectional-event':
        return this.createEventChannel(config);
      case 'server-live-state':
      case 'client-live-state':
        return this.createSyncChannel(config);
      case 'bidirectional-crdt':
        return this.createCrdtChannel(config);
      default:
        throw new Error(`Unknown data flow pattern: ${config.pattern}`);
    }
  }

  get(key: string): DataChannel | undefined {
    return this.channels.get(key);
  }

  getAll(): DataChannel[] {
    return [...this.channels.values()];
  }

  closeAll(): void {
    for (const ch of this.channels.values()) {
      ch.close();
    }
    this.channels.clear();
  }

  private createRpcChannel<T>(config: LiveStateConfig<T>): DataChannel {
    const channel = new ManagedChannel('rpc', config.key, () => {
      this.channels.delete(config.key);
    });
    this.channels.set(config.key, channel);
    return channel;
  }

  private createEventChannel<T>(config: LiveStateConfig<T>): DataChannel {
    this.deps.registerEventHandler(config.key, () => {});
    const channel = new ManagedChannel(config.pattern, config.key, () => {
      this.channels.delete(config.key);
    });
    this.channels.set(config.key, channel);
    return channel;
  }

  private createSyncChannel<T>(config: LiveStateConfig<T>): DataChannel {
    const syncConfig: SyncChannelConfig = {
      key: config.key,
      direction: patternToDirection(config.pattern),
      mode: patternToSyncMode(config.pattern),
      flush: {
        flushStrategy: granularityToFlushStrategy(config.granularity),
        batchIntervalMs: config.batchIntervalMs ?? 100,
        debounceMs: config.debounceMs ?? 50,
      },
      initialValue: config.initialValue,
    };
    this.deps.createSyncChannel(syncConfig);

    const channel = new ManagedChannel(config.pattern, config.key, () => {
      this.channels.delete(config.key);
    });
    this.channels.set(config.key, channel);
    return channel;
  }

  private createCrdtChannel<T>(config: LiveStateConfig<T>): DataChannel {
    this.deps.registerCrdt(config.key, 'lww-map');

    const syncConfig: SyncChannelConfig = {
      key: config.key,
      direction: 'bidirectional',
      mode: 'crdt',
      flush: {
        flushStrategy: granularityToFlushStrategy(config.granularity),
        batchIntervalMs: config.batchIntervalMs ?? 100,
        debounceMs: config.debounceMs ?? 50,
      },
      initialValue: config.initialValue,
    };
    this.deps.createSyncChannel(syncConfig);

    const channel = new ManagedChannel('bidirectional-crdt', config.key, () => {
      this.channels.delete(config.key);
    });
    this.channels.set(config.key, channel);
    return channel;
  }
}
