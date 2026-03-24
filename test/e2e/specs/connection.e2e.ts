import { test, expect } from '@playwright/test';

import { captureConsoleLogs, hasErrors } from '../helpers/console-capture';
import { collectPerfMetrics, savePerfMetrics } from '../helpers/perf-metrics';
import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test('page loads with datasole library', async ({ page }, testInfo) => {
  const logs = captureConsoleLogs(page);
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');

  const loaded = await page.evaluate(() => window.__datasole_loaded);
  expect(loaded).toBe(true);
  expect(hasErrors(logs)).toBe(false);

  await snap(page, testInfo, 'connection-page-loaded');

  const perf = await collectPerfMetrics(page);
  savePerfMetrics('connection-load', perf);
});

test('connects to WebSocket server', async ({ page }, testInfo) => {
  const logs = captureConsoleLogs(page);
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');

  const state = await page.evaluate(() => window.__connect());
  expect(state).toBe('connected');

  const connectionState = await page.evaluate(() => window.__getConnectionState());
  expect(connectionState).toBe('connected');
  expect(hasErrors(logs)).toBe(false);

  await snap(page, testInfo, 'connection-ws-connected');

  await page.evaluate(() => window.__disconnect());
  const disconnectedState = await page.evaluate(() => window.__getConnectionState());
  expect(disconnectedState).toBe('disconnected');

  await snap(page, testInfo, 'connection-ws-disconnected');
});

test('connects with auth token', async ({ page }, testInfo) => {
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready');

  const state = await page.evaluate(() => window.__connect({ auth: { token: 'valid-token' } }));
  expect(state).toBe('connected');

  await snap(page, testInfo, 'connection-auth-token');

  await page.evaluate(() => window.__disconnect());
});
