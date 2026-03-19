import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export default {
  input: 'src/shared/index.ts',
  output: [
    {
      file: 'dist/shared/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/shared/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  external: ['pako', 'fast-json-patch'],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        '__BUILD_VERSION__': JSON.stringify(pkg.version),
      },
    }),
    resolve({
      preferBuiltins: true,
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    }),
    commonjs(),
    typescript({
      tsconfig: './build/tsconfig.shared.json',
      noEmit: false,
      declaration: false,
    }),
  ],
};
