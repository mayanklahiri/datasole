import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.e2e.ts',
  testIgnore: '**/demos/**',
  timeout: 30000,
  retries: 1,
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
      grepInvert: /@bench/,
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
      },
      grepInvert: /@bench/,
    },
  ],
  reporter: [['list'], ['json', { outputFile: './reports/playwright-results.json' }]],
});
