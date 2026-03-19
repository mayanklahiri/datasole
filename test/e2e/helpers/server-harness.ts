import type { Server } from 'http';
import { startTestServer } from '../fixtures/server/test-server';

export class ServerHarness {
  private server: Server | null = null;
  private port = 0;

  async start(): Promise<number> {
    const result = await startTestServer();
    this.server = result.server;
    this.port = result.port;
    return this.port;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
