import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: './reports/playwright-results.json' }],
  ],
});
