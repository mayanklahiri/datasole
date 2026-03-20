/**
 * Ambient module declarations for optional peer dependencies.
 * These allow dynamic import() to type-check without the packages being installed.
 */

declare module 'ioredis' {
  class Redis {
    constructor(url: string);
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<string>;
    del(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    pttl(key: string): Promise<number>;
    pexpire(key: string, ms: number): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    duplicate(): Redis;
    multi(): RedisPipeline;
    quit(): Promise<string>;
  }

  interface RedisPipeline {
    incr(key: string): RedisPipeline;
    pexpire(key: string, ms: number): RedisPipeline;
    pttl(key: string): RedisPipeline;
    exec(): Promise<[Error | null, unknown][]>;
  }

  export default Redis;
}

declare module 'pg' {
  export class Pool {
    constructor(config: { connectionString: string });
    query(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }

  export interface PoolClient {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    release(): void;
  }
}

declare module '@opentelemetry/api' {
  export const metrics: {
    getMeter(name: string): Meter;
  };

  export interface Meter {
    createUpDownCounter(
      name: string,
      options?: { description?: string },
    ): { add(value: number): void };
  }
}
