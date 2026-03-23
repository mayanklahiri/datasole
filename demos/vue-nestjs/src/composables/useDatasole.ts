import {
  shallowRef,
  ref,
  watch,
  provide,
  inject,
  onMounted,
  onUnmounted,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';

const DS_KEY: InjectionKey<ShallowRef<DatasoleClient | null>> = Symbol('datasole');
const CONN_KEY: InjectionKey<Ref<ConnectionState>> = Symbol('datasole:conn');

/**
 * Call once at app root. Creates the DatasoleClient, connects, and provides
 * the client + connectionState to all descendants via inject().
 */
export function useDatasole() {
  const ds = shallowRef<DatasoleClient | null>(null);
  const connectionState = ref<ConnectionState>('disconnected');
  let interval: ReturnType<typeof setInterval> | undefined;

  provide(DS_KEY, ds);
  provide(CONN_KEY, connectionState);

  onMounted(() => {
    const client = new DatasoleClient({
      url: `ws://${window.location.host}`,
    });
    ds.value = client;
    client.connect();
    interval = setInterval(() => {
      connectionState.value = client.getConnectionState();
    }, 500);
  });

  onUnmounted(() => {
    if (interval) clearInterval(interval);
    ds.value?.disconnect();
    ds.value = null;
  });

  return { connectionState };
}

/**
 * Reactive ref that auto-updates from a datasole broadcast event.
 * No watch, no cleanup, no props needed in the consuming component.
 *
 *   const metrics = useDatasoleEvent<Metrics>('system-metrics');
 *   // metrics.value updates automatically — no Vuex, no Pinia
 */
export function useDatasoleEvent<T>(eventName: string): Ref<T | null> {
  const ds = inject(DS_KEY)!;
  const data = ref<T | null>(null) as Ref<T | null>;
  let cleanup: (() => void) | null = null;

  watch(
    ds,
    (client) => {
      cleanup?.();
      cleanup = null;
      if (!client) return;
      const handler = (ev: { data: T }) => {
        data.value = ev.data;
      };
      client.on(eventName, handler);
      cleanup = () => client.off(eventName, handler);
    },
    { immediate: true },
  );

  onUnmounted(() => cleanup?.());
  return data;
}

/**
 * Reactive ref that auto-syncs from datasole server-side state.
 * The server calls ds.setState(key, value) and this ref updates.
 *
 *   const messages = useDatasoleState<ChatMessage[]>('chat:messages');
 *   // messages.value auto-replaces on every server state change — the server IS the store
 */
export function useDatasoleState<T>(key: string): Ref<T | null> {
  const ds = inject(DS_KEY)!;
  const data = ref<T | null>(null) as Ref<T | null>;
  let cleanup: (() => void) | null = null;

  watch(
    ds,
    (client) => {
      cleanup?.();
      cleanup = null;
      if (!client) return;
      cleanup = client.subscribeState(key, (val: T) => {
        data.value = val;
      });
    },
    { immediate: true },
  );

  onUnmounted(() => cleanup?.());
  return data;
}

/** Raw client ref for imperative operations (emit, rpc). */
export function useDatasoleClient(): ShallowRef<DatasoleClient | null> {
  return inject(DS_KEY)!;
}

/** Reactive connection state. */
export function useConnectionState(): Ref<ConnectionState> {
  return inject(CONN_KEY)!;
}
