/**
 * Pluggable state backend interface, config, and options for key/value storage and pub/sub notifications.
 */

export interface StateBackend {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void;
  publish(key: string, value: unknown): Promise<void>;
}

export interface StateBackendOptions {
  prefix?: string;
}

export interface RedisBackendOptions extends StateBackendOptions {
  url?: string;
  keyPrefix?: string;
}

export interface PostgresBackendOptions extends StateBackendOptions {
  connectionString?: string;
  tableName?: string;
}

export interface BackendConfig {
  type: 'memory' | 'redis' | 'postgres';
  redis?: RedisBackendOptions;
  postgres?: PostgresBackendOptions;
}
