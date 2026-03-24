/**
 * Fallback WebSocket transport for environments where Web Workers are unavailable.
 */

import { compress, decompress, isCompressed } from '../../shared/codec';
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

  /** Register frame receive handler. */
  onMessage(handler: MessageHandler): void {
    this.onMessageHandler = handler;
  }

  /** Register open callback. */
  onOpen(handler: () => void): void {
    this.onOpenHandler = handler;
  }

  /** Register close callback. */
  onClose(handler: (code: number, reason: string) => void): void {
    this.onCloseHandler = handler;
  }

  /** Register error callback. */
  onError(handler: () => void): void {
    this.onErrorHandler = handler;
  }

  /** Open direct WebSocket connection (no worker). */
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
          const decompressed = isCompressed(raw) ? decompress(raw) : raw;
          const frame = decodeFrame(decompressed);
          this.onMessageHandler?.(frame);
        } catch {
          // Malformed frame
        }
      };
    });
  }

  /** Send encoded frame bytes over WebSocket. */
  send(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  /** Encode/compress a frame and send it over WebSocket. */
  sendFrame(frame: Frame): void {
    let encoded = encodeFrame(frame);
    if (encoded.length > COMPRESSION_THRESHOLD) {
      encoded = compress(encoded);
    }
    this.send(encoded);
  }

  /** Close active WebSocket connection. */
  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }

  /** Return true if websocket is currently open. */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
