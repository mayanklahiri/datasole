/**
 * PostgreSQL state backend using pg with LISTEN/NOTIFY for key change notifications.
 */
import { EventEmitter } from 'events';

import type { StateBackend, PostgresBackendOptions } from './types';

/** Unquoted PostgreSQL identifier: letters, digits, underscore; safe to interpolate after validation. */
function assertValidSqlIdentifier(name: string, label: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`${label} must be a simple SQL identifier (letters, digits, underscore only).`);
  }
  return name;
}

interface PgQueryResult {
  rows: Record<string, unknown>[];
  rowCount?: number | null;
}

type PgPool = {
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
  connect(): Promise<PgPoolClient>;
  end(): Promise<void>;
};

type PgPoolClient = {
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  release(): void;
};

function isPgModule(m: unknown): m is { Pool: new (config: unknown) => PgPool } {
  if (typeof m !== 'object' || m === null || !('Pool' in m)) return false;
  return typeof (m as { Pool: unknown }).Pool === 'function';
}

export class PostgresBackend implements StateBackend {
  private pool: PgPool | null = null;
  private listenClient: PgPoolClient | null = null;
  private emitter = new EventEmitter();
  private readonly connectionString: string;
  private readonly tableName: string;
  private readonly keyPrefix: string;

  constructor(options?: PostgresBackendOptions) {
    this.connectionString = options?.connectionString ?? 'postgresql://localhost:5432/datasole';
    this.tableName = assertValidSqlIdentifier(
      options?.tableName ?? 'datasole_state',
      'PostgresBackend tableName',
    );
    this.keyPrefix = options?.prefix ?? '';
  }

  async connect(): Promise<void> {
    const { Pool } = await this.loadPg();
    this.pool = new Pool({ connectionString: this.connectionString });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    this.listenClient = await this.pool.connect();
    await this.listenClient.query('LISTEN datasole_state_change');
    this.listenClient.on('notification', (msg: unknown) => {
      try {
        const payload = JSON.parse((msg as { payload: string }).payload) as {
          key: string;
          value: unknown;
        };
        this.emitter.emit(payload.key, payload.value);
      } catch {
        /* ignore malformed notifications */
      }
    });
  }

  private async loadPg(): Promise<{ Pool: new (config: unknown) => PgPool }> {
    try {
      const mod: unknown = await import('pg');
      if (!isPgModule(mod)) {
        throw new Error('PostgresBackend: "pg" module has unexpected shape');
      }
      return mod;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('PostgresBackend:')) throw e;
      throw new Error('PostgresBackend requires the "pg" package. Install it: npm install pg', {
        cause: e,
      });
    }
  }

  private prefixed(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}${key}` : key;
  }

  private ensureConnected(): PgPool {
    if (!this.pool) throw new Error('PostgresBackend not connected. Call connect() first.');
    return this.pool;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const pool = this.ensureConnected();
    const result = await pool.query(`SELECT value FROM ${this.tableName} WHERE key = $1`, [
      this.prefixed(key),
    ]);
    const row = result.rows[0];
    if (!row) return undefined;
    return row.value as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const pool = this.ensureConnected();
    await pool.query(
      `INSERT INTO ${this.tableName} (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [this.prefixed(key), JSON.stringify(value)],
    );
  }

  async delete(key: string): Promise<boolean> {
    const pool = this.ensureConnected();
    const result = await pool.query(`DELETE FROM ${this.tableName} WHERE key = $1`, [
      this.prefixed(key),
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void {
    const listener = (value: unknown) => handler(key, value);
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }

  async publish(key: string, value: unknown): Promise<void> {
    const pool = this.ensureConnected();
    await pool.query(`SELECT pg_notify('datasole_state_change', $1)`, [
      JSON.stringify({ key, value }),
    ]);
  }

  async disconnect(): Promise<void> {
    this.listenClient?.release();
    await this.pool?.end();
    this.pool = null;
    this.listenClient = null;
  }
}
