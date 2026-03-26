/**
 * Defines the ServerAdapter interface for attaching and detaching Datasole from an HTTP server.
 */
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export interface ServerAdapter {
  attach(server: HttpServer): void;
  onUpgrade(handler: UpgradeHandler): void;
  detach(): void;
}
