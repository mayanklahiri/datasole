import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';
import type { EventPayload, EventName, StateKeyName } from 'datasole';
import type { AppContract } from '../../shared/contract';

// ── Context ──────────────────────────────────────────────────────────

interface DatasoleContextValue {
  client: DatasoleClient<AppContract> | null;
  connectionState: ConnectionState;
}

const DatasoleContext = createContext<DatasoleContextValue>({
  client: null,
  connectionState: 'disconnected',
});

/**
 * Wrap your app in this provider. Creates the DatasoleClient, connects,
 * and makes the client available to all descendants via hooks.
 */
export function DatasoleProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<DatasoleClient<AppContract> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    const c = new DatasoleClient<AppContract>({ url: `ws://${window.location.host}` });
    setClient(c);
    void c.connect().then(() => setConnectionState(c.getConnectionState()));
    const interval = setInterval(() => setConnectionState(c.getConnectionState()), 100);
    return () => {
      clearInterval(interval);
      void c.disconnect();
    };
  }, []);

  return (
    <DatasoleContext.Provider value={{ client, connectionState }}>
      {children}
    </DatasoleContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────

/**
 * Reactive state from a datasole broadcast event.
 * No useEffect, no cleanup, no props needed in the consuming component.
 *
 *   const metrics = useDatasoleEvent<Metrics>(Event.SystemMetrics);
 *   // metrics updates automatically — no Redux, no Zustand
 */
export function useDatasoleEvent<K extends keyof AppContract['events'] & string>(
  eventName: K,
): AppContract['events'][K] | null {
  const { client } = useContext(DatasoleContext);
  const [data, setData] = useState<AppContract['events'][K] | null>(null);

  useEffect(() => {
    if (!client) return;
    const handler = (ev: EventPayload<AppContract['events'][K]>) => setData(ev.data);
    client.on(eventName, handler);
    return () => {
      client.off(eventName, handler);
    };
  }, [client, eventName]);

  return data;
}

/**
 * Reactive state that auto-syncs from datasole server-side state.
 * The server calls ds.setState(key, value) and this hook re-renders.
 *
 *   const messages = useDatasoleState<ChatMessage[]>(StateKey.ChatMessages);
 *   // messages auto-replaces on every server state change — the server IS the store
 */
export function useDatasoleState<K extends StateKeyName<AppContract>>(
  key: K,
): AppContract['state'][K] | null {
  const { client } = useContext(DatasoleContext);
  const [data, setData] = useState<AppContract['state'][K] | null>(null);

  useEffect(() => {
    if (!client) return;
    const sub = client.subscribeState(key, (val) => setData(val));
    return () => sub.unsubscribe();
  }, [client, key]);

  return data;
}

/** Raw client for imperative operations (emit, rpc). */
export function useDatasoleClient(): DatasoleClient<AppContract> | null {
  return useContext(DatasoleContext).client;
}

/** Reactive connection state. */
export function useConnectionState(): ConnectionState {
  return useContext(DatasoleContext).connectionState;
}
