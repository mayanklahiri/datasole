import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const shared = {
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_VERSION__: JSON.stringify(pkg.version),
      },
    }),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript({ tsconfig: './build/tsconfig.client.json', noEmit: false, declaration: false }),
  ],
};

function suppressThisIsUndefined(warning, warn) {
  if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('fast-json-patch')) return;
  warn(warning);
}

export default [
  {
    input: 'src/client/index.ts',
    output: [
      {
        file: 'dist/client/datasole.iife.min.js',
        format: 'iife',
        name: 'Datasole',
        sourcemap: true,
        plugins: [terser()],
      },
      {
        file: 'dist/client/datasole.mjs',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/client/datasole.cjs',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    onwarn: suppressThisIsUndefined,
    ...shared,
  },
];
