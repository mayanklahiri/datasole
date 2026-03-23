import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DatasoleService } from './datasole.service.js';

const PORT = parseInt(process.env.PORT || '4002', 10);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const datasoleService = app.get(DatasoleService);
  await datasoleService.init();
  datasoleService.ds.attach(app.getHttpServer());

  await app.listen(PORT);
  console.log(`\n  Vue+NestJS demo server running at http://localhost:${PORT}\n`);
}

bootstrap();
