import { test, expect } from '@playwright/test';

import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

test.describe('Sessions', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('saves and retrieves session data across reconnections', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() =>
      window.__connect({ auth: { headers: { 'x-user-id': 'session-user-1' } } }),
    );
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    const saveResult = await page.evaluate(() => window.__saveProgress(5, 500));
    expect(saveResult).toEqual({ ok: true });

    const progress = await page.evaluate(() => window.__getProgress());
    expect(progress).toEqual({ level: 5, score: 500 });

    await snap(page, testInfo, 'session-saved');

    await page.evaluate(() => window.__disconnect());
    await page.waitForFunction(() => window.__getConnectionState() !== 'connected');

    await page.evaluate(() =>
      window.__connect({ auth: { headers: { 'x-user-id': 'session-user-1' } } }),
    );
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    const restored = await page.evaluate(() => window.__getProgress());
    expect(restored).toEqual({ level: 5, score: 500 });

    await snap(page, testInfo, 'session-restored');

    await page.evaluate(() => window.__disconnect());
  });
});
