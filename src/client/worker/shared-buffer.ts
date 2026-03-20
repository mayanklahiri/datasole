/**
 * Worker-side SharedArrayBuffer ring buffer for zero-copy frame transfer to the main thread.
 *
 * Lock-free SPSC ring buffer — the worker is the sole producer.
 * Header layout must match MainThreadSharedBuffer: [readIndex, writeIndex, capacity, messageCount].
 */

const HEADER_SIZE = 16;

export class WorkerSharedBuffer {
  private buffer: SharedArrayBuffer | null = null;
  private header: Int32Array | null = null;
  private data: Uint8Array | null = null;

  init(buffer: SharedArrayBuffer): void {
    this.buffer = buffer;
    this.header = new Int32Array(this.buffer, 0, 4);
    this.data = new Uint8Array(this.buffer, HEADER_SIZE);
  }

  isAvailable(): boolean {
    return this.buffer !== null;
  }

  write(msg: Uint8Array): boolean {
    if (!this.header || !this.data) return false;

    const writeIdx = Atomics.load(this.header, 1);
    const readIdx = Atomics.load(this.header, 0);
    const capacity = Atomics.load(this.header, 2);

    const needed = 4 + msg.length;
    const used = writeIdx >= readIdx ? writeIdx - readIdx : capacity - readIdx + writeIdx;

    if (used + needed >= capacity) return false;

    let pos = writeIdx;
    this.data[pos % capacity] = (msg.length >> 24) & 0xff;
    this.data[(pos + 1) % capacity] = (msg.length >> 16) & 0xff;
    this.data[(pos + 2) % capacity] = (msg.length >> 8) & 0xff;
    this.data[(pos + 3) % capacity] = msg.length & 0xff;

    pos = (pos + 4) % capacity;
    for (let i = 0; i < msg.length; i++) {
      this.data[(pos + i) % capacity] = msg[i]!;
    }

    Atomics.store(this.header, 1, (writeIdx + needed) % capacity);
    Atomics.add(this.header, 3, 1);
    return true;
  }
}
