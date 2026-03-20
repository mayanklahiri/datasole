import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';
import { builtinModules } from 'module';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Peer deps that are always external (optional, dynamically imported)
const peerExternal = [
  'ioredis',
  'pg',
  '@nestjs/common',
  '@nestjs/websockets',
  '@opentelemetry/api',
  'ws',
];

const nodeExternal = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

// fast-json-patch and pako are CJS-only — they must be inlined into ESM output
// for Node.js native ESM compatibility (Node can't do named imports from CJS).
const cjsOnlyDeps = ['fast-json-patch', 'pako'];

function suppressThisIsUndefined(warning, warn) {
  if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('fast-json-patch')) return;
  warn(warning);
}

const sharedPlugins = [
  replace({
    preventAssignment: true,
    values: {
      __BUILD_VERSION__: JSON.stringify(pkg.version),
    },
  }),
  resolve({ preferBuiltins: true }),
  commonjs(),
  typescript({ tsconfig: './build/tsconfig.server.json', noEmit: false, declaration: false }),
];

export default [
  {
    input: 'src/server/index.ts',
    output: {
      file: 'dist/server/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    external: [...nodeExternal, ...peerExternal, ...cjsOnlyDeps],
    onwarn: suppressThisIsUndefined,
    plugins: sharedPlugins,
  },
  {
    input: 'src/server/index.ts',
    output: {
      file: 'dist/server/index.mjs',
      format: 'es',
      sourcemap: true,
    },
    external: [...nodeExternal, ...peerExternal],
    onwarn: suppressThisIsUndefined,
    plugins: sharedPlugins,
  },
];
