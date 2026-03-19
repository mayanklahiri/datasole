export interface TransportOptions {
  workerUrl?: string;
  useSharedArrayBuffer?: boolean;
}

export class WorkerProxy {
  private worker: Worker | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  async connect(_url: string, _options?: TransportOptions): Promise<void> {
    // TODO: spawn worker, setup postMessage bridge, optional SAB
    throw new Error('Not implemented');
  }

  async send(_data: Uint8Array): Promise<void> {
    // TODO: send data via worker postMessage
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
}
