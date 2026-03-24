import 'reflect-metadata';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import os from 'os';
import { DatasoleServer } from 'datasole/server';
import { createSeededRandom } from '../../../seeded-random.js';
import { AppContract, RpcMethod, Event, StateKey, ChatMessage } from '../../shared/contract';

@Injectable()
export class DatasoleService implements OnModuleDestroy {
  readonly ds = new DatasoleServer<AppContract>();
  private readonly rng = createSeededRandom();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private readonly chatHistory: ChatMessage[] = [];

  async init(): Promise<void> {
    await this.ds.setState(StateKey.ChatMessages, this.chatHistory);

    this.ds.events.on(Event.ChatSend, (payload: { data: { text: string; username: string } }) => {
      const { text, username } = payload.data;
      const msg: ChatMessage = { id: this.rng.uuid(), text, username, ts: Date.now() };
      this.chatHistory.push(msg);
      if (this.chatHistory.length > 50) this.chatHistory.shift();
      this.ds.setState(StateKey.ChatMessages, [...this.chatHistory]);
      this.ds.broadcast(Event.ChatMessage, msg);
    });

    this.ds.rpc.register(
      RpcMethod.RandomNumber,
      async ({ min, max }: { min: number; max: number }) => {
        return { value: this.rng.int(Math.floor(min), Math.floor(max)), generatedAt: Date.now() };
      },
    );

    this.metricsInterval = setInterval(() => {
      const snap = this.ds.metrics.snapshot();
      const now = new Date();
      this.ds.broadcast(Event.SystemMetrics, {
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
