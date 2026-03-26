/**
 * Typed state persistence, optional {@link SyncChannel} batching, and STATE_PATCH fan-out to clients.
 * Data-flow channels compose RPC, events, state, and CRDT via {@link ChannelManager}.
 */
import type { DatasoleContract } from '../../../shared/contract';
import type { StatePatch } from '../../../shared/types';
import type { DataChannel, LiveStateConfig } from '../../../shared/types/data-flow';
import type { StateBackend } from '../../backends/types';
import type { BroadcastSink } from '../../protocol/broadcast-sink';
import type { CrdtManager } from '../crdt/crdt-manager';
import type { ChannelManagerDeps } from '../data-flow/channel-manager';
import { ChannelManager } from '../data-flow/channel-manager';
import type { EventBus } from '../events/event-bus';
import type { StateManager } from '../state/state-manager';
import { SyncChannel } from '../sync/sync-channel';
import type { SyncChannelConfig } from '../sync/types';

export class ServerLiveState<T extends DatasoleContract> {
  private readonly syncChannels = new Map<string, SyncChannel>();
  private readonly channelManager: ChannelManager;

  constructor(
    private readonly backend: StateBackend,
    private readonly state: StateManager<T>,
    private readonly events: EventBus<T>,
    private readonly crdt: CrdtManager,
    private readonly broadcastSink: BroadcastSink,
  ) {
    const channelDeps: ChannelManagerDeps = {
      createSyncChannel: (config) => {
        this.createSyncChannel(config);
      },
      registerEventHandler: (event, handler) => {
        this.events.on(event as keyof T['events'] & string, handler as never);
      },
      registerCrdt: (key, type) => {
        this.crdt.registerByType(key, type);
      },
    };
    this.channelManager = new ChannelManager(channelDeps);
  }

  /** Create a high-level data channel (RPC/events/state/CRDT composition). */
  createDataChannel<V = unknown>(config: LiveStateConfig<V>): DataChannel {
    return this.channelManager.create(config);
  }

  /** Return an existing data channel by key. */
  getDataChannel(key: string): DataChannel | undefined {
    return this.channelManager.get(key);
  }

  /** Create and register a sync channel for batched/debounced patch flows. */
  createSyncChannel<V = unknown>(config: SyncChannelConfig<V>): SyncChannel<V> {
    const channel = new SyncChannel(config, this.backend);
    channel.onFlush((patches) => {
      this.broadcastSink.broadcastStatePatch(config.key, patches);
    });
    this.syncChannels.set(config.key, channel as SyncChannel);
    return channel;
  }

  /** Return an existing sync channel by key. */
  getSyncChannel(key: string): SyncChannel | undefined {
    return this.syncChannels.get(key);
  }

  /** Get the latest typed state value for a key. */
  async getState<K extends keyof T['state'] & string>(key: K): Promise<T['state'][K] | undefined> {
    return this.state.getState(key);
  }

  /** Set and broadcast typed state value for a key. */
  async setState<K extends keyof T['state'] & string>(
    key: K,
    value: T['state'][K],
  ): Promise<StatePatch[]> {
    const patches = await this.state.setState(key, value);
    if (patches.length > 0) {
      const channel = this.syncChannels.get(key);
      if (channel) {
        channel.enqueue(patches);
      } else {
        this.broadcastSink.broadcastStatePatch(key, patches);
      }
    }
    return patches;
  }

  /** @internal */
  closeAllDataChannels(): void {
    this.channelManager.closeAll();
  }

  /** @internal */
  async destroySyncChannels(): Promise<void> {
    for (const channel of this.syncChannels.values()) {
      await channel.destroy();
    }
    this.syncChannels.clear();
  }
}
