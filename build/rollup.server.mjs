import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';
import { builtinModules } from 'module';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const external = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  'ioredis',
  'pg',
  '@nestjs/common',
  '@nestjs/websockets',
];

export default {
  input: 'src/server/index.ts',
  output: [
    {
      file: 'dist/server/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/server/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        '__BUILD_VERSION__': JSON.stringify(pkg.version),
      },
    }),
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: './build/tsconfig.server.json', noEmit: false, declaration: false }),
  ],
};
