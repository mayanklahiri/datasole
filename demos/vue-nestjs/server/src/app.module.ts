import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { DatasoleService } from './datasole.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(__dirname, '../../dist/client');
const hasClientBuild = existsSync(clientDist);

@Module({
  imports: hasClientBuild ? [ServeStaticModule.forRoot({ rootPath: clientDist })] : [],
  providers: [DatasoleService],
  exports: [DatasoleService],
})
export class AppModule {}
