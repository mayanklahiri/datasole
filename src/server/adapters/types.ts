import type { Server as HttpServer } from 'http';

export interface ServerAdapter {
  attach(server: HttpServer): void;
  detach(): void;
}
