/**
 * Pluggable state backend interface and options for key/value storage and pub/sub notifications.
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
