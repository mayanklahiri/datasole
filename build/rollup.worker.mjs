import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export default {
  input: 'src/client/worker/transport-worker.ts',
  output: {
    file: 'dist/client/datasole-worker.iife.min.js',
    format: 'iife',
    name: 'DatasoleWorker',
    sourcemap: true,
    plugins: [terser()],
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        '__BUILD_VERSION__': JSON.stringify(pkg.version),
      },
    }),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript({ tsconfig: './build/tsconfig.client.json', noEmit: false, declaration: false }),
  ],
};
