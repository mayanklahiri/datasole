/**
 * Persists per-user session blobs in a StateBackend so clients can resume state after reconnects, with optional flushing.
 */
import type { StateBackend } from '../../backends/types';
import type { ConnectionContext } from '../../transport/connection-context';
import type { RealtimePrimitive } from '../types';

export interface SessionOptions {
  flushThreshold?: number;
  flushIntervalMs?: number;
  ttlMs?: number;
  enableChangeStream?: boolean;
}

export interface SessionState<T = unknown> {
  data: T;
  version: number;
  lastModified: number;
  dirty: boolean;
}

type ChangeHandler = (userId: string, key: string, value: unknown, version: number) => void;

export class SessionManager implements RealtimePrimitive {
  private sessions = new Map<string, Map<string, SessionState>>();
  private dirtyCount = new Map<string, number>();
  private changeHandlers = new Set<ChangeHandler>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushThreshold: number;
  private readonly flushIntervalMs: number;
  private readonly ttlMs: number;

  constructor(
    private backend: StateBackend,
    options?: SessionOptions,
  ) {
    this.flushThreshold = options?.flushThreshold ?? 10;
    this.flushIntervalMs = options?.flushIntervalMs ?? 5000;
    this.ttlMs = options?.ttlMs ?? 3600_000;

    if (this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => void this.flushAll(), this.flushIntervalMs);
    }
  }

  /** Load persisted session state for the current connection user. */
  async snapshot(ctx: ConnectionContext): Promise<Record<string, unknown>> {
    const userId = ctx.userId;
    if (!userId) return {};
    const persisted = await this.backend.get<Record<string, unknown>>(`session:${userId}`);
    if (persisted) {
      const sessionMap = new Map<string, SessionState>();
      for (const [key, value] of Object.entries(persisted)) {
        sessionMap.set(key, { data: value, version: 0, lastModified: Date.now(), dirty: false });
      }
      this.sessions.set(userId, sessionMap);
    }
    return persisted ?? {};
  }

  /** Alias for `snapshot` used in reconnect flows. */
  async restore(ctx: ConnectionContext): Promise<Record<string, unknown>> {
    return this.snapshot(ctx);
  }

  /** Get one session key for a user from in-memory session cache. */
  get<V = unknown>(userId: string, key: string): V | undefined {
    return this.sessions.get(userId)?.get(key)?.data as V | undefined;
  }

  /** Set one session key/value and mark it dirty for flush. */
  set(userId: string, key: string, value: unknown): void {
    let userSession = this.sessions.get(userId);
    if (!userSession) {
      userSession = new Map();
      this.sessions.set(userId, userSession);
    }

    const existing = userSession.get(key);
    const version = (existing?.version ?? 0) + 1;
    userSession.set(key, {
      data: value,
      version,
      lastModified: Date.now(),
      dirty: true,
    });

    const dirty = (this.dirtyCount.get(userId) ?? 0) + 1;
    this.dirtyCount.set(userId, dirty);

    for (const handler of this.changeHandlers) {
      handler(userId, key, value, version);
    }

    if (dirty >= this.flushThreshold) {
      this.flushUser(userId).catch(() => {});
    }
  }

  /** Delete a session key for a user. */
  delete(userId: string, key: string): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;
    const deleted = session.delete(key);
    if (deleted) {
      this.dirtyCount.set(userId, (this.dirtyCount.get(userId) ?? 0) + 1);
    }
    return deleted;
  }

  /** Register callback for local session mutation events. */
  onChange(handler: ChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  /** Persist one user's dirty session values to backend. */
  async flushUser(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    const data: Record<string, unknown> = {};
    for (const [key, state] of session) {
      data[key] = state.data;
      state.dirty = false;
    }

    await this.backend.set(`session:${userId}`, data);
    await this.backend.publish(`session:${userId}`, data);
    this.dirtyCount.set(userId, 0);
  }

  /** Flush all users with pending dirty data. */
  async flushAll(): Promise<void> {
    const flushes: Promise<void>[] = [];
    for (const [userId, dirty] of this.dirtyCount) {
      if (dirty > 0) {
        flushes.push(this.flushUser(userId));
      }
    }
    await Promise.all(flushes);
  }

  /** Flush and evict one user's in-memory session cache. */
  async evict(userId: string): Promise<void> {
    await this.flushUser(userId);
    this.sessions.delete(userId);
    this.dirtyCount.delete(userId);
  }

  /** Stop periodic flush and persist remaining dirty session state. */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushAll();
  }
}
