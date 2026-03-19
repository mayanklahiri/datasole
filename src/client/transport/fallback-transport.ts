import { compress, decompress } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import { decodeFrame, encodeFrame } from '../../shared/protocol';
import type { Frame } from '../../shared/protocol';

type MessageHandler = (frame: Frame) => void;

export class FallbackTransport {
  private ws: WebSocket | null = null;
  private onMessageHandler: MessageHandler | null = null;
  private onOpenHandler: (() => void) | null = null;
  private onCloseHandler: ((code: number, reason: string) => void) | null = null;
  private onErrorHandler: (() => void) | null = null;

  onMessage(handler: MessageHandler): void {
    this.onMessageHandler = handler;
  }

  onOpen(handler: () => void): void {
    this.onOpenHandler = handler;
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.onCloseHandler = handler;
  }

  onError(handler: () => void): void {
    this.onErrorHandler = handler;
  }

  async connect(url: string, _protocols?: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.onOpenHandler?.();
        resolve();
      };

      this.ws.onerror = () => {
        this.onErrorHandler?.();
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        this.onCloseHandler?.(event.code, event.reason);
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = new Uint8Array(event.data as ArrayBuffer);
          const decompressed = raw.length > COMPRESSION_THRESHOLD ? decompress(raw) : raw;
          const frame = decodeFrame(decompressed);
          this.onMessageHandler?.(frame);
        } catch {
          // Malformed frame
        }
      };
    });
  }

  send(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  sendFrame(frame: Frame): void {
    let encoded = encodeFrame(frame);
    if (encoded.length > COMPRESSION_THRESHOLD) {
      encoded = compress(encoded);
    }
    this.send(encoded);
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
