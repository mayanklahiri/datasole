import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { DatasoleServer } from 'datasole/server';
import { createSeededRandom } from '../../seeded-random.mjs';
import { RpcMethod, Event, StateKey } from '../shared/contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_ROOT = resolve(__dirname, '../shared');
const PORT = parseInt(process.env.PORT || '4000', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ─── Datasole ──────────────────────────────────────────────────────
const ds = new DatasoleServer();
await ds.initialize();
const rng = createSeededRandom();

// ─── Chat ──────────────────────────────────────────────────────────
const chatHistory = [];

ds.events.on(Event.ChatSend, (payload) => {
  const { text, username } = payload.data;
  const msg = { id: rng.uuid(), text, username, ts: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > 50) chatHistory.shift();
  void (async () => {
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

// ─── Static file serving ───────────────────────────────────────────
function serveStatic(req, res) {
  if (res.headersSent || res.writableEnded) return;
  const url = req.url.split('?')[0];

  if (url.startsWith('/shared/')) {
    const rel = url.slice('/shared/'.length);
    const filePath = resolve(SHARED_ROOT, rel);
    if (!filePath.startsWith(SHARED_ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const mime = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(readFileSync(filePath));
    return;
  }

  const filePath = resolve(__dirname, '../client', url === '/' ? 'index.html' : url.slice(1));
  if (!filePath.startsWith(resolve(__dirname, '../client'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const mime = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
}

const httpServer = createServer(serveStatic);
ds.attach(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\n  Vanilla demo running at http://localhost:${PORT}\n`);
});
