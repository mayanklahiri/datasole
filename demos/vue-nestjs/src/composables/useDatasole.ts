import { shallowRef, ref, onMounted, onUnmounted } from 'vue';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';

export function useDatasole() {
  const ds = shallowRef<DatasoleClient | null>(null);
  const connectionState = ref<ConnectionState>('disconnected');
  let interval: ReturnType<typeof setInterval> | undefined;

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

  return { ds, connectionState };
}
