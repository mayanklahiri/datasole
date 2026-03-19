import type { Server } from 'http';

import type { DatasoleServer } from '../../../src/server/server';
import { startTestServer } from '../fixtures/server/test-server';

export class ServerHarness {
  private server: Server | null = null;
  private port = 0;
  private ds: DatasoleServer | null = null;
  private serverLogs: string[] = [];

  async start(): Promise<number> {
    const result = await startTestServer();
    this.server = result.server;
    this.port = result.port;
    this.ds = result.ds;
    this.serverLogs = result.logs;
    return this.port;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getDatasoleServer(): DatasoleServer {
    if (!this.ds) throw new Error('Server not started');
    return this.ds;
  }

  getLogs(): string[] {
    return this.serverLogs;
  }

  async stop(): Promise<void> {
    if (this.ds) {
      await this.ds.close();
      this.ds = null;
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
