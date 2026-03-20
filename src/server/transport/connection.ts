/**
 * Wraps a ws WebSocket with identity, ConnectionContext, and helpers used by the rest of the server stack.
 */
import type { WebSocket } from 'ws';

import type { AuthContext } from '../../shared/types';

import type { ConnectionContext } from './connection-context';
import { DefaultConnectionContext } from './connection-context';

export interface ConnectionInfo {
  id: string;
  remoteAddress: string;
  connectedAt: number;
  auth: AuthContext | null;
}

export class Connection {
  readonly info: ConnectionInfo;
  readonly context: ConnectionContext;
  private ws: WebSocket | null;

  constructor(info: ConnectionInfo, ws?: WebSocket) {
    this.info = info;
    this.ws = ws ?? null;
    this.context = new DefaultConnectionContext({
      connectionId: info.id,
      auth: info.auth,
      remoteAddress: info.remoteAddress,
    });
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('Connection not open');
    }
    return new Promise((resolve, reject) => {
      this.ws!.send(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close(code?: number, reason?: string): void {
    this.ws?.close(code ?? 1000, reason);
    this.ws = null;
  }

  isOpen(): boolean {
    return this.ws?.readyState === 1;
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this.ws?.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = Array.isArray(raw)
        ? Buffer.concat(raw)
        : Buffer.isBuffer(raw)
          ? raw
          : Buffer.from(raw);
      handler(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    });
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.ws?.on('close', (code: number, reason: Buffer) => {
      handler(code, reason.toString());
    });
  }
}
