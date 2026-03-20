/**
 * PostgreSQL state backend (placeholder).
 */
import type { StateBackend, StateBackendOptions } from '../types';

export interface PostgresBackendOptions extends StateBackendOptions {
  connectionString?: string;
}

export class PostgresBackend implements StateBackend {
  constructor(_options?: PostgresBackendOptions) {
    // TODO: requires 'pg' peer dependency
  }

  async get<T = unknown>(_key: string): Promise<T | undefined> {
    throw new Error('Not implemented: install pg peer dependency');
  }

  async set<T = unknown>(_key: string, _value: T): Promise<void> {
    throw new Error('Not implemented');
  }

  async delete(_key: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  subscribe(_key: string, _handler: (key: string, value: unknown) => void): () => void {
    throw new Error('Not implemented');
  }

  async publish(_key: string, _value: unknown): Promise<void> {
    throw new Error('Not implemented');
  }
}
