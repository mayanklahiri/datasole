/**
 * Dedicated Playwright config for performance benchmarks.
 * Runs in complete isolation from functional e2e tests to ensure clean,
 * reproducible numbers with no CPU/memory contention from other tests.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.e2e.ts',
  testIgnore: '**/demos/**',
  timeout: 120000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  grep: /@bench/,
  use: {
    headless: true,
    trace: 'off',
  },
  projects: [
    {
      name: 'bench',
      use: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  reporter: [['list'], ['json', { outputFile: './reports/perf/bench-playwright-results.json' }]],
});
