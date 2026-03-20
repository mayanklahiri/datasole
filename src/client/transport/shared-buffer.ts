/**
 * Main-thread SharedArrayBuffer ring buffer for zero-copy frame transfer with the transport worker.
 *
 * Lock-free SPSC (single-producer, single-consumer) ring buffer.
 * The worker writes frames; the main thread reads them.
 * Header layout: 4 × Int32 = [readIndex, writeIndex, capacity, messageCount].
 */

const HEADER_SIZE = 16;

export class MainThreadSharedBuffer {
  private buffer: SharedArrayBuffer | null = null;
  private header: Int32Array | null = null;
  private data: Uint8Array | null = null;

  create(size: number): SharedArrayBuffer {
    const totalSize = HEADER_SIZE + size;
    this.buffer = new SharedArrayBuffer(totalSize);
    this.header = new Int32Array(this.buffer, 0, 4);
    this.data = new Uint8Array(this.buffer, HEADER_SIZE);
    Atomics.store(this.header, 0, 0);
    Atomics.store(this.header, 1, 0);
    Atomics.store(this.header, 2, size);
    Atomics.store(this.header, 3, 0);
    return this.buffer;
  }

  isAvailable(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  read(): Uint8Array | null {
    if (!this.header || !this.data) return null;
    const count = Atomics.load(this.header, 3);
    if (count <= 0) return null;

    const readIdx = Atomics.load(this.header, 0);
    const capacity = Atomics.load(this.header, 2);

    const d = this.data;
    const len =
      ((d[readIdx % capacity]! << 24) |
        (d[(readIdx + 1) % capacity]! << 16) |
        (d[(readIdx + 2) % capacity]! << 8) |
        d[(readIdx + 3) % capacity]!) >>>
      0;

    const msgStart = (readIdx + 4) % capacity;
    const msg = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      msg[i] = d[(msgStart + i) % capacity]!;
    }

    Atomics.store(this.header, 0, (readIdx + 4 + len) % capacity);
    Atomics.sub(this.header, 3, 1);
    return msg;
  }

  getBuffer(): SharedArrayBuffer | null {
    return this.buffer;
  }
}
