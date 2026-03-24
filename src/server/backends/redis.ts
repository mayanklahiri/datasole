/**
 * Redis state backend using ioredis with pub/sub for key change notifications.
 */
import { EventEmitter } from 'events';

import type { StateBackend, RedisBackendOptions } from './types';

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  del(key: string): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  duplicate(): RedisClient;
  quit(): Promise<string>;
};

function isRedisConstructor(x: unknown): x is new (url: string) => RedisClient {
  return typeof x === 'function';
}

export class RedisBackend implements StateBackend {
  private client: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private emitter = new EventEmitter();
  private readonly keyPrefix: string;
  private readonly url: string;
  private subscriptions = new Set<string>();

  constructor(options?: RedisBackendOptions) {
    this.keyPrefix = options?.keyPrefix ?? options?.prefix ?? 'ds:';
    this.url = options?.url ?? 'redis://localhost:6379';
  }

  async connect(): Promise<void> {
    const Redis = await this.loadRedis();
    this.client = new Redis(this.url);
    this.subscriber = this.client.duplicate();
    this.subscriber.on('message', (channel: unknown, message: unknown) => {
      const key = (channel as string).slice(this.keyPrefix.length);
      try {
        const value: unknown = JSON.parse(message as string);
        this.emitter.emit(key, value);
      } catch {
        this.emitter.emit(key, message);
      }
    });
  }

  private async loadRedis(): Promise<new (url: string) => RedisClient> {
    try {
      const mod: unknown = await import('ioredis');
      const Redis = (mod as { default?: unknown }).default ?? mod;
      if (!isRedisConstructor(Redis)) {
        throw new Error('RedisBackend: "ioredis" module has unexpected shape');
      }
      return Redis;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('RedisBackend:')) throw e;
      throw new Error(
        'RedisBackend requires the "ioredis" package. Install it: npm install ioredis',
        { cause: e },
      );
    }
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private ensureConnected(): RedisClient {
    if (!this.client) throw new Error('RedisBackend not connected. Call connect() first.');
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const client = this.ensureConnected();
    const raw = await client.get(this.prefixed(key));
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const client = this.ensureConnected();
    await client.set(this.prefixed(key), JSON.stringify(value));
  }

  async delete(key: string): Promise<boolean> {
    const client = this.ensureConnected();
    const count = await client.del(this.prefixed(key));
    return count > 0;
  }

  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void {
    const listener = (value: unknown) => handler(key, value);
    this.emitter.on(key, listener);
    const channel = this.prefixed(key);
    if (!this.subscriptions.has(channel) && this.subscriber) {
      this.subscriptions.add(channel);
      void this.subscriber.subscribe(channel);
    }
    return () => this.emitter.off(key, listener);
  }

  async publish(key: string, value: unknown): Promise<void> {
    const client = this.ensureConnected();
    await client.publish(this.prefixed(key), JSON.stringify(value));
  }

  async disconnect(): Promise<void> {
    await this.subscriber?.quit();
    await this.client?.quit();
    this.client = null;
    this.subscriber = null;
  }
}
