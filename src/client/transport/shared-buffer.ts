/**
 * Main-thread SharedArrayBuffer creation and management.
 */

export class MainThreadSharedBuffer {
  private buffer: SharedArrayBuffer | null = null;

  create(size: number): SharedArrayBuffer {
    this.buffer = new SharedArrayBuffer(size);
    return this.buffer;
  }

  isAvailable(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  // TODO: implement ring-buffer read/write for main thread side
}
