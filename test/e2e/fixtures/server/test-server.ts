import express from 'express';
import { createServer } from 'http';
import path from 'path';

export async function startTestServer() {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use('/static', express.static(path.resolve(__dirname, '../../../../dist/client')));
  app.use(express.static(path.resolve(__dirname, '../client')));

  const server = createServer(app);

  return new Promise<{ server: typeof server; port: number }>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}
