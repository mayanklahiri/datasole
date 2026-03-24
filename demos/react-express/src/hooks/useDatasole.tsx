import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';

// ── Context ──────────────────────────────────────────────────────────

interface DatasoleContextValue {
  client: DatasoleClient | null;
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
  const [client, setClient] = useState<DatasoleClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    const c = new DatasoleClient({ url: `ws://${window.location.host}` });
    setClient(c);
    c.connect();
    const interval = setInterval(() => setConnectionState(c.getConnectionState()), 500);
    return () => {
      clearInterval(interval);
      c.disconnect();
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
 *   const metrics = useDatasoleEvent<Metrics>('system-metrics');
 *   // metrics updates automatically — no Redux, no Zustand
 */
export function useDatasoleEvent<T>(eventName: string): T | null {
  const { client } = useContext(DatasoleContext);
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!client) return;
    const handler = (ev: { data: T }) => setData(ev.data);
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
 *   const messages = useDatasoleState<ChatMessage[]>('chat:messages');
 *   // messages auto-replaces on every server state change — the server IS the store
 */
export function useDatasoleState<T>(key: string): T | null {
  const { client } = useContext(DatasoleContext);
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!client) return;
    const sub = client.subscribeState(key, (val: T) => setData(val));
    return () => sub.unsubscribe();
  }, [client, key]);

  return data;
}

/** Raw client for imperative operations (emit, rpc). */
export function useDatasoleClient(): DatasoleClient | null {
  return useContext(DatasoleContext).client;
}

/** Reactive connection state. */
export function useConnectionState(): ConnectionState {
  return useContext(DatasoleContext).connectionState;
}
