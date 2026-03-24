import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { DatasoleService } from './datasole.service.js';

const PORT = parseInt(process.env.PORT || '4002', 10);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const datasoleService = app.get(DatasoleService);
  await datasoleService.init();
  await app.listen(PORT);
  datasoleService.ds.attach(app.getHttpServer());
  console.log(`\n  Vue+NestJS demo server running at http://localhost:${PORT}\n`);
}

bootstrap();
