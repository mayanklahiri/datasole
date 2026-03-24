import type { DatasoleContract } from 'datasole/server';

export enum RpcMethod {
  RandomNumber = 'randomNumber',
}

export enum Event {
  ChatSend = 'chat:send',
  ChatMessage = 'chat:message',
  SystemMetrics = 'system-metrics',
}

export enum StateKey {
  ChatMessages = 'chat:messages',
}

export interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.RandomNumber]: {
      params: { min: number; max: number };
      result: { value: number; generatedAt: number };
    };
  };
  events: {
    [Event.ChatSend]: { text: string; username: string };
    [Event.ChatMessage]: ChatMessage;
    [Event.SystemMetrics]: {
      uptime: number;
      connections: number;
      messagesIn: number;
      messagesOut: number;
      cpuUsage: number;
      memoryMB: number;
      cpuCount: number;
      totalMemoryGB: number;
      serverTime: string;
      timezone: string;
      timestamp: number;
    };
  };
  state: {
    [StateKey.ChatMessages]: ChatMessage[];
  };
}
