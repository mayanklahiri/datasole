import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function suppressThisIsUndefined(warning, warn) {
  if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('fast-json-patch')) return;
  warn(warning);
}

export default {
  input: 'src/shared/index.ts',
  external: ['fast-json-patch', 'pako'],
  output: [
    {
      file: 'dist/shared/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/shared/index.mjs',
      format: 'es',
      sourcemap: true,
    },
  ],
  onwarn: suppressThisIsUndefined,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_VERSION__: JSON.stringify(pkg.version),
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
