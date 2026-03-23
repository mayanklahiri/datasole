import { createServer } from 'http';
import { randomInt, randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import express from 'express';
import { DatasoleServer } from 'datasole/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4001', 10);

const app = express();

// Serve datasole worker IIFE for web worker transport (before static/catch-all)
const dsWorkerPath = resolve(
  __dirname,
  '../node_modules/datasole/dist/client/datasole-worker.iife.min.js',
);
if (existsSync(dsWorkerPath)) {
  app.get('/datasole-worker.iife.min.js', (_req, res) => {
    res.sendFile(dsWorkerPath);
  });
}

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
const ds = new DatasoleServer();
ds.attach(httpServer);

// ─── Chat ──────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

const chatHistory: ChatMessage[] = [];

ds.on('chat:send', (payload: { data: { text: string; username: string } }) => {
  const { text, username } = payload.data;
  const msg: ChatMessage = { id: randomUUID(), text, username, ts: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > 50) chatHistory.shift();
  ds.setState('chat:messages', [...chatHistory]);
  ds.broadcast('chat:message', msg);
});

ds.setState('chat:messages', chatHistory);

// ─── RPC ───────────────────────────────────────────────────────────
ds.rpc('randomNumber', async ({ min, max }: { min: number; max: number }) => {
  return { value: randomInt(Math.floor(min), Math.floor(max) + 1), generatedAt: Date.now() };
});

// ─── System metrics broadcast ──────────────────────────────────────
setInterval(() => {
  const snap = ds.getMetrics().snapshot();
  ds.broadcast('system-metrics', {
    uptime: snap.uptime,
    connections: snap.connections,
    messagesIn: snap.messagesIn,
    messagesOut: snap.messagesOut,
    cpuUsage: Math.round(process.cpuUsage().user / 1000),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: Date.now(),
  });
}, 2000);

httpServer.listen(PORT, () => {
  console.log(`\n  React+Express demo server running at http://localhost:${PORT}\n`);
});
