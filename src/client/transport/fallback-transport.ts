export class FallbackTransport {
  private ws: WebSocket | null = null;

  async connect(_url: string, _protocols?: string[]): Promise<void> {
    // TODO: direct main-thread WebSocket for environments without Workers
    throw new Error('Not implemented');
  }

  async send(_data: Uint8Array): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }
}
