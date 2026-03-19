import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
    },
    environment: 'node',
  },
});
