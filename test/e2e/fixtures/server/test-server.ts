import express from 'express';
import { createServer } from 'http';
import path from 'path';

import { DatasoleServer } from '../../../../src/server/server';
import { MemoryBackend } from '../../../../src/server/backends/memory';
import { PNCounter } from '../../../../src/shared/crdt/pn-counter';
import {
  type TestContract,
  TestRpc,
  TestEvent,
  TestState,
} from '../../../../test/helpers/test-contract';

export interface TestServerResult {
  server: ReturnType<typeof createServer>;
  port: number;
  ds: DatasoleServer<TestContract>;
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

  const ds = new DatasoleServer<TestContract>({
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
  ds.rpc.register(TestRpc.Echo, async (params) => {
    log(`RPC echo: ${JSON.stringify(params)}`);
    return params;
  });

  ds.rpc.register(TestRpc.Add, async (params: { a: number; b: number }) => {
    log(`RPC add: ${params.a} + ${params.b}`);
    return { sum: params.a + params.b };
  });

  ds.rpc.register(TestRpc.Error, async () => {
    throw new Error('Intentional test error');
  });

  ds.rpc.register(TestRpc.Slow, async (params: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, params.ms));
    return { waited: params.ms };
  });

  // --- Session RPCs ---
  ds.rpc.register(TestRpc.SaveProgress, async (params: { level: number; score: number }, ctx) => {
    const uid = ctx?.connection?.userId ?? 'anon';
    ds.sessions.set(uid, 'level', params.level);
    ds.sessions.set(uid, 'score', params.score);
    log(`Session saveProgress: ${uid} level=${params.level} score=${params.score}`);
    return { ok: true };
  });

  ds.rpc.register(TestRpc.GetProgress, async (_params, ctx) => {
    const uid = ctx?.connection?.userId ?? 'anon';
    const level = ds.sessions.get<number>(uid, 'level') ?? 1;
    const score = ds.sessions.get<number>(uid, 'score') ?? 0;
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
    await ds.setState(TestState.Board, JSON.parse(JSON.stringify(board)));
  }
  syncBoard();

  ds.rpc.register(TestRpc.AddTask, async (params: { title: string }) => {
    const id = `task-${board.tasks.length + 1}`;
    board.tasks.push({ id, title: params.title, column: 'todo' });
    await syncBoard();
    log(`TaskBoard addTask: ${id} "${params.title}"`);
    return { id };
  });

  ds.rpc.register(TestRpc.MoveTask, async (params: { taskId: string; column: string }) => {
    const task = board.tasks.find((t) => t.id === params.taskId);
    if (task) task.column = params.column;
    await syncBoard();
    log(`TaskBoard moveTask: ${params.taskId} → ${params.column}`);
    return { ok: !!task };
  });

  // --- CRDT: shared counter ---
  const counter = new PNCounter('server');

  ds.events.on(TestEvent.CrdtOp, (payload) => {
    log(`CRDT op: ${JSON.stringify(payload.data)}`);
    counter.apply(payload.data);
    ds.broadcast(TestEvent.CrdtState, counter.state());
  });

  ds.events.on(TestEvent.CrdtGet, () => {
    ds.broadcast(TestEvent.CrdtState, counter.state());
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
  ds.rpc.register(TestRpc.TriggerAlert, async (params: { message: string }) => {
    alertChannel.enqueue([{ op: 'replace', path: '/latest', value: params.message }]);
    log(`SyncChannel alert: ${params.message}`);
    return { ok: true };
  });

  ds.rpc.register(TestRpc.PushMetric, async (params: { cpu: number }) => {
    metricsChannel.enqueue([{ op: 'replace', path: '/cpu', value: params.cpu }]);
    log(`SyncChannel metric: cpu=${params.cpu}`);
    return { ok: true };
  });

  // --- Benchmark RPCs ---
  ds.rpc.register(
    TestRpc.StartBroadcastFlood,
    async (params: { durationMs: number; intervalMs?: number }) => {
      const end = Date.now() + params.durationMs;
      const interval = params.intervalMs ?? 1;
      let count = 0;
      const tick = () => {
        if (Date.now() >= end) return;
        ds.broadcast(TestEvent.BenchEvent, { seq: count++, ts: Date.now() });
        setTimeout(tick, interval);
      };
      tick();
      log(`Benchmark: broadcasting for ${params.durationMs}ms`);
      return { ok: true };
    },
  );

  let benchStateCounter = 0;
  ds.rpc.register(
    TestRpc.StartStateMutationFlood,
    async (params: { durationMs: number; intervalMs?: number }) => {
      const end = Date.now() + params.durationMs;
      const interval = params.intervalMs ?? 5;
      const tick = async () => {
        if (Date.now() >= end) return;
        benchStateCounter++;
        await ds.setState(TestState.BenchState, {
          counter: benchStateCounter,
          ts: Date.now(),
          payload: `item-${benchStateCounter}`,
        });
        setTimeout(tick, interval);
      };
      void tick();
      log(`Benchmark: mutating state for ${params.durationMs}ms`);
      return { ok: true };
    },
  );

  // --- Binary frame streaming benchmark ---
  ds.rpc.register(
    TestRpc.StartBinaryFrameFlood,
    async (params: { durationMs: number; frameSizeBytes: number }) => {
      const end = Date.now() + params.durationMs;
      let count = 0;
      const frameData = Buffer.alloc(params.frameSizeBytes);
      // Fill with pseudo-random data to prevent trivial compression
      for (let i = 0; i < frameData.length; i++) frameData[i] = (i * 37 + 17) & 0xff;
      const tick = () => {
        if (Date.now() >= end) return;
        // Overwrite first 8 bytes with sequence + timestamp for realism
        frameData.writeUInt32BE(count, 0);
        frameData.writeUInt32BE(Date.now() & 0xffffffff, 4);
        ds.broadcast(TestEvent.BenchBinaryFrame, {
          seq: count++,
          frame: Array.from(frameData.subarray(0, Math.min(params.frameSizeBytes, 256))),
          size: params.frameSizeBytes,
        });
        setImmediate(tick);
      };
      tick();
      log(`Benchmark: binary frame flood ${params.frameSizeBytes}B for ${params.durationMs}ms`);
      return { ok: true };
    },
  );

  // --- RPC with large JSON payload benchmark ---
  ds.rpc.register(TestRpc.EchoLargeJson, async (params: { payload: unknown }) => {
    return params;
  });

  // Heavy-payload flood: sends large JSON events at max rate to stress client decode/decompress
  ds.rpc.register(
    TestRpc.StartHeavyPayloadFlood,
    async (params: { durationMs: number; payloadSizeKb?: number }) => {
      const end = Date.now() + params.durationMs;
      let count = 0;
      const sizeKb = params.payloadSizeKb ?? 5;
      const filler = 'x'.repeat(sizeKb * 1024);
      const tick = () => {
        if (Date.now() >= end) return;
        ds.broadcast(TestEvent.BenchHeavyPayload, {
          seq: count++,
          ts: Date.now(),
          data: filler,
          nested: { a: count, b: filler.slice(0, 200), c: [1, 2, 3, count] },
        });
        setImmediate(tick);
      };
      tick();
      log(`Benchmark: heavy payload flood ${sizeKb}KB for ${params.durationMs}ms`);
      return { ok: true };
    },
  );

  // --- Two-way low-latency echo (game tick / trade confirm) ---
  ds.events.on(TestEvent.BenchGameTick, (payload) => {
    ds.broadcast(TestEvent.BenchGameState, {
      seq: payload.data.seq,
      ack: true,
      ts: Date.now(),
    });
  });

  // --- Events ---
  ds.events.on(TestEvent.ClientPing, (payload) => {
    log(`Event client-ping: ${JSON.stringify(payload.data)}`);
    ds.broadcast(TestEvent.ServerPong, { echo: payload.data });
  });

  let chatSeq = 0;
  ds.events.on(TestEvent.ChatSend, (payload) => {
    log(`Event chat:send: ${JSON.stringify(payload.data)}`);
    ds.broadcast(TestEvent.ChatMessage, { text: payload.data.text, seq: ++chatSeq });
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
