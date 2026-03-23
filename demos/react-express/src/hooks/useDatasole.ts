import { useEffect, useRef, useState } from 'react';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';

export function useDatasole(): { ds: DatasoleClient | null; connectionState: ConnectionState } {
  const dsRef = useRef<DatasoleClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    const client = new DatasoleClient({
      url: `ws://${window.location.host}`,
    });
    dsRef.current = client;
    client.connect();

    const interval = setInterval(() => {
      setConnectionState(client.getConnectionState());
    }, 500);

    return () => {
      clearInterval(interval);
      client.disconnect();
      dsRef.current = null;
    };
  }, []);

  return { ds: dsRef.current, connectionState };
}
