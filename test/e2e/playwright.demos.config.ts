import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs/demos',
  testMatch: '**/*.demo.e2e.ts',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  reporter: [['list'], ['json', { outputFile: './reports/playwright-demos-results.json' }]],
});
