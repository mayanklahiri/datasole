import { createServer } from 'http';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import os from 'os';
import express from 'express';
import { DatasoleServer } from 'datasole/server';
import { createSeededRandom } from '../../seeded-random.mjs';
import { AppContract, RpcMethod, Event, StateKey, ChatMessage } from '../shared/contract';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4001', 10);

const app = express();

// In production, serve the Vite-built client
const clientDist = resolve(__dirname, '../dist/client');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);

// ─── Datasole ──────────────────────────────────────────────────────
const ds = new DatasoleServer<AppContract>();
const rng = createSeededRandom();
await ds.initialize();
ds.attach(httpServer);

// ─── Chat ──────────────────────────────────────────────────────────
const chatHistory: ChatMessage[] = [];

ds.events.on(Event.ChatSend, (payload) => {
  const { text, username } = payload.data;
  const msg: ChatMessage = { id: rng.uuid(), text, username, ts: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > 50) chatHistory.shift();
  void (async () => {
    // Snapshot — MemoryBackend stores by reference; never pass the live chatHistory array.
    await ds.setState(StateKey.ChatMessages, [...chatHistory]);
    ds.broadcast(Event.ChatMessage, msg);
  })();
});

await ds.setState(StateKey.ChatMessages, [...chatHistory]);

// ─── RPC ───────────────────────────────────────────────────────────
ds.rpc.register(RpcMethod.RandomNumber, async ({ min, max }) => {
  return { value: rng.int(Math.floor(min), Math.floor(max)), generatedAt: Date.now() };
});

// ─── System metrics broadcast ──────────────────────────────────────
setInterval(() => {
  const snap = ds.metrics.snapshot();
  const now = new Date();
  ds.broadcast(Event.SystemMetrics, {
    uptime: snap.uptime,
    connections: snap.connections,
    messagesIn: snap.messagesIn,
    messagesOut: snap.messagesOut,
    cpuUsage: Math.round(process.cpuUsage().user / 1000),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    cpuCount: os.cpus().length,
    totalMemoryGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
    serverTime: now.toLocaleTimeString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Date.now(),
  });
}, 2000);

httpServer.listen(PORT, () => {
  console.log(`\n  React+Express demo server running at http://localhost:${PORT}\n`);
});
