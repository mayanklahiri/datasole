import express from 'express';
import { createServer } from 'http';
import path from 'path';

import { DatasoleServer } from '../../../../src/server/server';
import { MemoryBackend } from '../../../../src/server/state/backends/memory';
import { PNCounter } from '../../../../src/shared/crdt/pn-counter';

export interface TestServerResult {
  server: ReturnType<typeof createServer>;
  port: number;
  ds: DatasoleServer;
  logs: string[];
}

export async function startTestServer(): Promise<TestServerResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use('/static', express.static(path.resolve(__dirname, '../../../../dist/client')));
  // Serve worker IIFE at root so useWorker: true works with default workerUrl
  app.get('/datasole-worker.iife.min.js', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../../../dist/client/datasole-worker.iife.min.js'));
  });
  app.use(express.static(path.resolve(__dirname, '../client')));

  const httpServer = createServer(app);

  const ds = new DatasoleServer({
    stateBackend: new MemoryBackend(),
    authHandler: async (req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token') ?? (req.headers['x-auth-token'] as string);
      const userId = url.searchParams.get('userId') ?? (req.headers['x-user-id'] as string);
      if (token === 'valid-token') {
        return {
          authenticated: true,
          userId: userId || 'test-user',
          roles: ['admin'],
          metadata: { token },
        };
      }
      if (token === 'reject') {
        return { authenticated: false };
      }
      return { authenticated: true, userId: userId || 'anon' };
    },
    session: {
      flushThreshold: 2,
      flushIntervalMs: 1000,
    },
  });

  // --- RPC handlers ---
  ds.rpc('echo', async (params) => {
    log(`RPC echo: ${JSON.stringify(params)}`);
    return params;
  });

  ds.rpc('add', async (params: { a: number; b: number }) => {
    log(`RPC add: ${params.a} + ${params.b}`);
    return { sum: params.a + params.b };
  });

  ds.rpc('error', async () => {
    throw new Error('Intentional test error');
  });

  ds.rpc('slow', async (params: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, params.ms));
    return { waited: params.ms };
  });

  // --- Session RPCs ---
  ds.rpc('saveProgress', async (params: { level: number; score: number }, ctx) => {
    const uid = ctx?.connection?.userId ?? 'anon';
    ds.setSessionValue(uid, 'level', params.level);
    ds.setSessionValue(uid, 'score', params.score);
    log(`Session saveProgress: ${uid} level=${params.level} score=${params.score}`);
    return { ok: true };
  });

  ds.rpc('getProgress', async (_params, ctx) => {
    const uid = ctx?.connection?.userId ?? 'anon';
    const level = ds.getSessionValue<number>(uid, 'level') ?? 1;
    const score = ds.getSessionValue<number>(uid, 'score') ?? 0;
    log(`Session getProgress: ${uid} level=${level} score=${score}`);
    return { level, score };
  });

  // --- Task board RPCs ---
  const board = {
    columns: ['todo', 'in-progress', 'done'],
    tasks: [] as Array<{ id: string; title: string; column: string }>,
  };
  async function syncBoard() {
    // Deep clone to avoid mutation-in-place making diff empty
    await ds.setState('board', JSON.parse(JSON.stringify(board)));
  }
  syncBoard();

  ds.rpc('addTask', async (params: { title: string }) => {
    const id = `task-${board.tasks.length + 1}`;
    board.tasks.push({ id, title: params.title, column: 'todo' });
    await syncBoard();
    log(`TaskBoard addTask: ${id} "${params.title}"`);
    return { id };
  });

  ds.rpc('moveTask', async (params: { taskId: string; column: string }) => {
    const task = board.tasks.find((t) => t.id === params.taskId);
    if (task) task.column = params.column;
    await syncBoard();
    log(`TaskBoard moveTask: ${params.taskId} → ${params.column}`);
    return { ok: !!task };
  });

  // --- CRDT: shared counter ---
  const counter = new PNCounter('server');

  ds.on('crdt:op', (payload) => {
    log(`CRDT op: ${JSON.stringify(payload.data)}`);
    counter.apply(payload.data);
    ds.broadcast('crdt:state', counter.state());
  });

  ds.on('crdt:get', () => {
    ds.broadcast('crdt:state', counter.state());
  });

  // --- Sync channels ---
  const alertChannel = ds.createSyncChannel({
    key: 'alerts',
    direction: 'server-to-client',
    mode: 'json-patch',
    flush: { flushStrategy: 'immediate' },
  });

  const metricsChannel = ds.createSyncChannel({
    key: 'metrics',
    direction: 'server-to-client',
    mode: 'json-patch',
    flush: { flushStrategy: 'batched', batchIntervalMs: 100 },
  });

  // RPC to trigger sync channel updates
  ds.rpc('triggerAlert', async (params: { message: string }) => {
    alertChannel.enqueue([{ op: 'replace', path: '/latest', value: params.message }]);
    log(`SyncChannel alert: ${params.message}`);
    return { ok: true };
  });

  ds.rpc('pushMetric', async (params: { cpu: number }) => {
    metricsChannel.enqueue([{ op: 'replace', path: '/cpu', value: params.cpu }]);
    log(`SyncChannel metric: cpu=${params.cpu}`);
    return { ok: true };
  });

  // --- Benchmark RPCs ---
  ds.rpc('startBroadcastFlood', async (params: { durationMs: number; intervalMs?: number }) => {
    const end = Date.now() + params.durationMs;
    const interval = params.intervalMs ?? 1;
    let count = 0;
    const tick = () => {
      if (Date.now() >= end) return;
      ds.broadcast('bench:event', { seq: count++, ts: Date.now() });
      setTimeout(tick, interval);
    };
    tick();
    log(`Benchmark: broadcasting for ${params.durationMs}ms`);
    return { ok: true };
  });

  let benchStateCounter = 0;
  ds.rpc('startStateMutationFlood', async (params: { durationMs: number; intervalMs?: number }) => {
    const end = Date.now() + params.durationMs;
    const interval = params.intervalMs ?? 5;
    const tick = async () => {
      if (Date.now() >= end) return;
      benchStateCounter++;
      await ds.setState('benchState', {
        counter: benchStateCounter,
        ts: Date.now(),
        payload: `item-${benchStateCounter}`,
      });
      setTimeout(tick, interval);
    };
    void tick();
    log(`Benchmark: mutating state for ${params.durationMs}ms`);
    return { ok: true };
  });

  // --- Events ---
  ds.on('client-ping', (payload) => {
    log(`Event client-ping: ${JSON.stringify(payload.data)}`);
    ds.broadcast('server-pong', { echo: payload.data });
  });

  ds.on('chat:send', (payload) => {
    log(`Event chat:send: ${JSON.stringify(payload.data)}`);
    ds.broadcast('chat:message', { text: payload.data.text, timestamp: Date.now() });
  });

  // Server logs endpoint
  app.get('/logs', (_req, res) => {
    res.json(logs);
  });

  ds.attach(httpServer);

  return new Promise<TestServerResult>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      log(`Test server started on port ${port}`);
      resolve({ server: httpServer, port, ds, logs });
    });
  });
}
