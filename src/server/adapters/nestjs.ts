import type { Server as HttpServer } from 'http';

import type { ServerAdapter } from './types';

export class DatasoleNestAdapter implements ServerAdapter {
  attach(_server: HttpServer): void {
    // TODO: implement NestJS WebSocketAdapter interface
    // Requires @nestjs/common and @nestjs/websockets as peer deps
  }

  detach(): void {
    // TODO: cleanup
  }

  create(_port: number, _options?: unknown): unknown {
    throw new Error('Not implemented');
  }

  bindClientConnect(_server: unknown, _callback: (...args: unknown[]) => unknown): void {
    throw new Error('Not implemented');
  }

  bindClientDisconnect(_client: unknown, _callback: (...args: unknown[]) => unknown): void {
    throw new Error('Not implemented');
  }

  bindMessageHandlers(
    _client: unknown,
    _handlers: unknown[],
    _process: (...args: unknown[]) => unknown,
  ): void {
    throw new Error('Not implemented');
  }

  close(_server: unknown): void {
    throw new Error('Not implemented');
  }
}
