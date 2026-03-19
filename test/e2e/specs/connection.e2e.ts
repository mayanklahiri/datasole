import { test, expect } from '@playwright/test';
import { ServerHarness } from '../helpers/server-harness';
import { captureConsoleLogs, hasErrors } from '../helpers/console-capture';
import { collectPerfMetrics, savePerfMetrics } from '../helpers/perf-metrics';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test('page loads with datasole library', async ({ page }) => {
  const logs = captureConsoleLogs(page);
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');
  const loaded = await page.evaluate(() => (window as any).__datasole_loaded);
  expect(loaded).toBe(true);
  expect(hasErrors(logs)).toBe(false);
  const perf = await collectPerfMetrics(page);
  savePerfMetrics('connection-load', perf);
});
