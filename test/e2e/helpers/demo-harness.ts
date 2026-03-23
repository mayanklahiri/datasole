/**
 * Harness for demo e2e tests. Manages npm install (if needed), npm build,
 * and starting/stopping a demo server in production mode.
 */
import { execSync, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const DEMOS_ROOT = path.resolve(__dirname, '../../../demos');

export interface DemoConfig {
  name: string;
  dir: string;
  port: number;
  startCommand: string[];
}

export const DEMO_CONFIGS: Record<string, DemoConfig> = {
  vanilla: {
    name: 'Vanilla JS',
    dir: path.join(DEMOS_ROOT, 'vanilla'),
    port: 4000,
    startCommand: ['node', 'server.mjs'],
  },
  'react-express': {
    name: 'React + Express',
    dir: path.join(DEMOS_ROOT, 'react-express'),
    port: 4001,
    startCommand: ['npx', 'tsx', 'server/index.ts'],
  },
  'vue-nestjs': {
    name: 'Vue 3 + NestJS',
    dir: path.join(DEMOS_ROOT, 'vue-nestjs'),
    port: 4002,
    startCommand: ['npx', 'tsx', 'server/src/main.ts'],
  },
};

export class DemoHarness {
  private proc: ChildProcess | null = null;
  private readonly config: DemoConfig;
  private logs: string[] = [];

  constructor(demoKey: string) {
    const cfg = DEMO_CONFIGS[demoKey];
    if (!cfg) throw new Error(`Unknown demo: ${demoKey}`);
    this.config = cfg;
  }

  /**
   * Install deps if node_modules is missing, then build.
   */
  prepare(): void {
    const { dir } = this.config;

    if (!existsSync(path.join(dir, 'node_modules'))) {
      execSync('npm install', { cwd: dir, stdio: 'pipe', timeout: 60_000 });
    }

    const pkg = JSON.parse(require('fs').readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    if (pkg.scripts?.build) {
      execSync('npm run build', { cwd: dir, stdio: 'pipe', timeout: 60_000 });
    }
  }

  /**
   * Start the demo server in production mode. Resolves once the port is accepting connections.
   */
  async start(): Promise<void> {
    const { dir, port, startCommand } = this.config;
    const [cmd, ...args] = startCommand;

    this.proc = spawn(cmd, args, {
      cwd: dir,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.proc.stdout?.on('data', (chunk: Buffer) => {
      this.logs.push(chunk.toString());
    });
    this.proc.stderr?.on('data', (chunk: Buffer) => {
      this.logs.push(chunk.toString());
    });

    await this.waitForPort(port, 15_000);
  }

  getUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  getName(): string {
    return this.config.name;
  }

  getLogs(): string[] {
    return this.logs;
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    const p = this.proc;
    this.proc = null;

    return new Promise<void>((resolve) => {
      p.on('exit', () => resolve());
      p.kill('SIGTERM');
      setTimeout(() => {
        try {
          p.kill('SIGKILL');
        } catch {
          /* already dead */
        }
        resolve();
      }, 5000);
    });
  }

  private async waitForPort(port: number, timeoutMs: number): Promise<void> {
    const { createConnection } = await import('net');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const connected = await new Promise<boolean>((resolve) => {
        const sock = createConnection({ port, host: '127.0.0.1' }, () => {
          sock.destroy();
          resolve(true);
        });
        sock.on('error', () => {
          sock.destroy();
          resolve(false);
        });
      });
      if (connected) return;
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error(
      `Demo "${this.config.name}" did not start on port ${port} within ${timeoutMs}ms.\n` +
        `Logs:\n${this.logs.join('')}`,
    );
  }
}
