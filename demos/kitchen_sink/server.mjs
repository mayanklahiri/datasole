/**
 * Kitchen Sink demo — vanilla Node.js HTTP server + DatasoleServer
 *
 * Demonstrates: RPC, server events (system metrics broadcast), live state
 * (synchronized list of objects), client events, and server metrics.
 *
 * Run:  node demos/kitchen_sink/server.mjs
 */
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatasoleServer } from '../../dist/server/index.mjs';
import { PNCounter } from '../../dist/shared/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Datasole server ───────────────────────────────────────────────
const ds = new DatasoleServer();

// ─── In-memory demo state ──────────────────────────────────────────
let items = [
  { id: 1, name: 'Alpha Widget', status: 'active', value: 42 },
  { id: 2, name: 'Beta Service', status: 'idle', value: 17 },
  { id: 3, name: 'Gamma Processor', status: 'active', value: 88 },
];
let nextId = 4;

// Publish initial state
await ds.setState('items', items);

// ─── RPC handlers ──────────────────────────────────────────────────

ds.rpc('getItems', async () => items);

ds.rpc('addItem', async ({ name }) => {
  const item = { id: nextId++, name, status: 'active', value: Math.floor(Math.random() * 100) };
  items.push(item);
  await ds.setState('items', items);
  return item;
});

ds.rpc('removeItem', async ({ id }) => {
  items = items.filter((i) => i.id !== id);
  await ds.setState('items', items);
  return { ok: true };
});

ds.rpc('getMetrics', async () => {
  return ds.getMetrics().snapshot();
});

ds.rpc('echo', async (params) => params);

// ─── CRDT: shared like counter ─────────────────────────────────────
ds.registerCrdt('likes', new PNCounter('server'));

// ─── Client event listener ─────────────────────────────────────────
ds.on('ping', (data) => {
  console.log('[event] client ping:', data);
});

// ─── Periodic server broadcasts ────────────────────────────────────
setInterval(() => {
  const metrics = ds.getMetrics().snapshot();
  const sysMetrics = {
    uptime: metrics.uptime,
    connections: metrics.connections,
    messagesIn: metrics.messagesIn,
    messagesOut: metrics.messagesOut,
    cpuUsage: Math.round(process.cpuUsage().user / 1000),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: Date.now(),
  };
  ds.broadcast('system-metrics', sysMetrics);
}, 2000);

// Randomized item value updates
setInterval(async () => {
  if (items.length === 0) return;
  const idx = Math.floor(Math.random() * items.length);
  items[idx].value += Math.floor(Math.random() * 11) - 5;
  const statuses = ['active', 'idle', 'warning', 'error'];
  if (Math.random() < 0.15) {
    items[idx].status = statuses[Math.floor(Math.random() * statuses.length)];
  }
  await ds.setState('items', items);
}, 3000);

// ─── HTTP server (serves index.html + IIFE bundle) ────────────────
const indexHtml = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');
const clientBundle = readFileSync(resolve(__dirname, '../../dist/client/datasole.iife.min.js'));
const workerBundle = readFileSync(
  resolve(__dirname, '../../dist/client/datasole-worker.iife.min.js'),
);

const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
  } else if (req.url === '/datasole.iife.min.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(clientBundle);
  } else if (req.url === '/datasole-worker.iife.min.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(workerBundle);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

ds.attach(httpServer);
httpServer.listen(PORT, () => {
  console.log(`\n  🎛  Kitchen Sink demo running at http://localhost:${PORT}\n`);
});
