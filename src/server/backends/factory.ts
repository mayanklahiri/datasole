/**
 * Factory for creating StateBackend instances from serializable config.
 * Each execution context (main thread, worker thread, child process) calls
 * createBackend() with the same config to get its own connection.
 */
import { MemoryBackend } from './memory';
import { PostgresBackend } from './postgres';
import { RedisBackend } from './redis';
import type { BackendConfig, StateBackend } from './types';

export function createBackend(config: BackendConfig): StateBackend {
  switch (config.type) {
    case 'memory':
      return new MemoryBackend();
    case 'redis':
      return new RedisBackend(config.redis);
    case 'postgres':
      return new PostgresBackend(config.postgres);
    default:
      throw new Error(`Unknown backend type: ${String(config.type)}`);
  }
}
