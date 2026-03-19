import { test, expect } from '@playwright/test';

import { captureConsoleLogs, hasErrors } from '../helpers/console-capture';
import { collectPerfMetrics, savePerfMetrics } from '../helpers/perf-metrics';
import { saveScreenshot } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

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

test('connects to WebSocket server', async ({ page }) => {
  const logs = captureConsoleLogs(page);
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');

  const state = await page.evaluate(() => (window as any).__connect());
  expect(state).toBe('connected');

  const connectionState = await page.evaluate(() => (window as any).__getConnectionState());
  expect(connectionState).toBe('connected');
  expect(hasErrors(logs)).toBe(false);

  await saveScreenshot(page, 'tutorial-1-connection');
  await page.evaluate(() => (window as any).__disconnect());
  const disconnectedState = await page.evaluate(() => (window as any).__getConnectionState());
  expect(disconnectedState).toBe('disconnected');
});

test('connects with auth token', async ({ page }) => {
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');

  const state = await page.evaluate(() =>
    (window as any).__connect({ auth: { token: 'valid-token' } }),
  );
  expect(state).toBe('connected');
  await page.evaluate(() => (window as any).__disconnect());
});
