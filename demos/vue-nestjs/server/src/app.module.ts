import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { DatasoleService } from './datasole.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(__dirname, '../../dist/client');

const imports: unknown[] = [];

if (existsSync(clientDist)) {
  imports.push(
    ServeStaticModule.forRoot({
      rootPath: clientDist,
    }),
  );
}

@Module({
  imports: imports as Parameters<typeof Module>[0]['imports'],
  providers: [DatasoleService],
  exports: [DatasoleService],
})
export class AppModule {}
