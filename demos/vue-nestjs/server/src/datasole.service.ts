import 'reflect-metadata';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import os from 'os';
import { DatasoleServer } from 'datasole/server';
import { createSeededRandom } from '../../../seeded-random.js';

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

@Injectable()
export class DatasoleService implements OnModuleDestroy {
  readonly ds = new DatasoleServer();
  private readonly rng = createSeededRandom();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private readonly chatHistory: ChatMessage[] = [];

  async init(): Promise<void> {
    await this.ds.setState('chat:messages', this.chatHistory);

    this.ds.on('chat:send', (payload: { data: { text: string; username: string } }) => {
      const { text, username } = payload.data;
      const msg: ChatMessage = { id: this.rng.uuid(), text, username, ts: Date.now() };
      this.chatHistory.push(msg);
      if (this.chatHistory.length > 50) this.chatHistory.shift();
      this.ds.setState('chat:messages', [...this.chatHistory]);
      this.ds.broadcast('chat:message', msg);
    });

    this.ds.rpc('randomNumber', async ({ min, max }: { min: number; max: number }) => {
      return { value: this.rng.int(Math.floor(min), Math.floor(max)), generatedAt: Date.now() };
    });

    this.metricsInterval = setInterval(() => {
      const snap = this.ds.getMetrics().snapshot();
      const now = new Date();
      this.ds.broadcast('system-metrics', {
        uptime: snap.uptime,
        connections: snap.connections,
        messagesIn: snap.messagesIn,
        messagesOut: snap.messagesOut,
        cpuUsage: Math.round(process.cpuUsage().user / 1000),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuCount: os.cpus().length,
        totalMemoryGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
        serverTime: now.toLocaleTimeString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: Date.now(),
      });
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    this.ds.close();
  }
}
