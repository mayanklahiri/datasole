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
  '@opentelemetry/api',
  'fast-json-patch',
  'pako',
  'ws',
];

function suppressThisIsUndefined(warning, warn) {
  if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('fast-json-patch')) return;
  warn(warning);
}

export default {
  input: 'src/server/index.ts',
  output: [
    {
      file: 'dist/server/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/server/index.mjs',
      format: 'es',
      sourcemap: true,
    },
  ],
  external,
  onwarn: suppressThisIsUndefined,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_VERSION__: JSON.stringify(pkg.version),
      },
    }),
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: './build/tsconfig.server.json', noEmit: false, declaration: false }),
  ],
};
