/**
 * Main-thread proxy that communicates with the transport Web Worker via postMessage.
 */

export interface TransportOptions {
  workerUrl?: string;
  useSharedArrayBuffer?: boolean;
}

export class WorkerProxy {
  private worker: Worker | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  /** Spawn worker, connect socket inside worker thread, and await open handshake. */
  async connect(url: string, options?: TransportOptions): Promise<void> {
    const workerUrl = options?.workerUrl ?? '/__ds/datasole-worker.iife.min.js';

    return new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(workerUrl);
      } catch {
        reject(new Error('Failed to create Worker'));
        return;
      }

      const openHandler = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === 'open') {
          this.worker?.removeEventListener('message', openHandler);
          resolve();
        } else if (msg.type === 'error') {
          this.worker?.removeEventListener('message', openHandler);
          reject(new Error('WebSocket connection failed in worker'));
        }
      };
      this.worker.addEventListener('message', openHandler);

      this.worker.addEventListener('message', (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return;
        const { type, payload } = event.data;
        if (typeof type !== 'string') return;
        const handlers = this.listeners.get(type);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(payload);
            } catch {
              // Isolate handler errors.
            }
          }
        }
      });

      this.worker.postMessage({ type: 'connect', payload: { url } });
    });
  }

  /** Transfer encoded frame bytes to worker transport. */
  async send(data: Uint8Array): Promise<void> {
    if (!this.worker) throw new Error('Worker not initialized');
    this.worker.postMessage({ type: 'send', payload: { data } }, [data.buffer]);
  }

  /** Initialize SharedArrayBuffer bridge used by worker/main thread. */
  initSharedBuffer(buffer: SharedArrayBuffer): void {
    if (!this.worker) throw new Error('Worker not initialized');
    this.worker.postMessage({ type: 'init-sab', payload: { buffer } });
  }

  /** Disconnect worker transport and terminate worker instance. */
  async disconnect(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'disconnect' });
      this.worker.terminate();
      this.worker = null;
    }
  }

  /** Register worker event listener (message, close, sab-frame). */
  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  /** Remove worker event listener. */
  off(event: string, handler: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
}
