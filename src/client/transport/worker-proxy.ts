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

  async connect(url: string, options?: TransportOptions): Promise<void> {
    const workerUrl = options?.workerUrl ?? '/datasole-worker.iife.min.js';

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
          resolve();
        } else if (msg.type === 'error') {
          reject(new Error('WebSocket connection failed in worker'));
        }
      };
      this.worker.addEventListener('message', openHandler, { once: false });

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

  async send(data: Uint8Array): Promise<void> {
    if (!this.worker) throw new Error('Worker not initialized');
    this.worker.postMessage({ type: 'send', payload: { data } }, [data.buffer]);
  }

  initSharedBuffer(buffer: SharedArrayBuffer): void {
    if (!this.worker) throw new Error('Worker not initialized');
    this.worker.postMessage({ type: 'init-sab', payload: { buffer } });
  }

  async disconnect(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'disconnect' });
      this.worker.terminate();
      this.worker = null;
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
}
