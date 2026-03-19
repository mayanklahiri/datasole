import express from 'express';
import { createServer } from 'http';
import path from 'path';

import { DatasoleServer } from '../../../../src/server/server';
import { MemoryBackend } from '../../../../src/server/state/backends/memory';

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
  app.use(express.static(path.resolve(__dirname, '../client')));

  const httpServer = createServer(app);

  const ds = new DatasoleServer({
    stateBackend: new MemoryBackend(),
    authHandler: async (req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token') ?? (req.headers['x-auth-token'] as string);
      if (token === 'valid-token') {
        return { authenticated: true, userId: 'test-user', roles: ['admin'], metadata: { token } };
      }
      if (token === 'reject') {
        return { authenticated: false };
      }
      return { authenticated: true, userId: 'anon' };
    },
  });

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

  ds.on('client-ping', (payload) => {
    log(`Event client-ping: ${JSON.stringify(payload.data)}`);
    ds.broadcast('server-pong', { echo: payload.data });
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
