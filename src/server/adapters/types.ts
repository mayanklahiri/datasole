/**
 * Defines the ServerAdapter interface for attaching and detaching Datasole from an HTTP server.
 */
import type { Server as HttpServer } from 'http';

export interface ServerAdapter {
  attach(server: HttpServer): void;
  detach(): void;
}
