export class WorkerSharedBuffer {
  private buffer: SharedArrayBuffer | null = null;
  private view: Int32Array | null = null;

  init(buffer: SharedArrayBuffer): void {
    this.buffer = buffer;
    this.view = new Int32Array(this.buffer);
  }

  isAvailable(): boolean {
    return this.buffer !== null;
  }

  // TODO: implement ring-buffer read/write for worker side
}
