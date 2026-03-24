import 'reflect-metadata';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { DatasoleService } from './datasole.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4002', 10);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve datasole worker IIFE for web worker transport.
  // Registered on the underlying Express instance before NestJS middleware
  // so the route is resolved before @nestjs/serve-static's catch-all.
  const dsWorkerPathCandidates = [
    resolve(__dirname, '../../../../dist/client/datasole-worker.iife.min.js'),
    resolve(__dirname, '../../node_modules/datasole/dist/client/datasole-worker.iife.min.js'),
  ];
  const dsWorkerPath = dsWorkerPathCandidates.find((p) => existsSync(p));
  if (dsWorkerPath) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      get(
        path: string,
        handler: (
          req: unknown,
          res: { type(contentType: string): { send(body: Buffer): void } },
        ) => void,
      ): void;
    };
    expressApp.get('/datasole-worker.iife.min.js', (_req, res) => {
      res.type('application/javascript').send(readFileSync(dsWorkerPath));
    });
  }

  const datasoleService = app.get(DatasoleService);
  await datasoleService.init();
  datasoleService.ds.attach(app.getHttpServer());

  await app.listen(PORT);
  console.log(`\n  Vue+NestJS demo server running at http://localhost:${PORT}\n`);
}

bootstrap();
