import { test, expect } from '@playwright/test';

import { ServerHarness } from '../helpers/server-harness';
import { saveScreenshot } from '../helpers/screenshots';

test.describe('Sessions', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('saves and retrieves session data across reconnections', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    // Connect as user-1
    await page.evaluate(() =>
      (window as any).__connect({ auth: { headers: { 'x-user-id': 'session-user-1' } } }),
    );
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    // Save progress
    const saveResult = await page.evaluate(() => (window as any).__saveProgress(5, 500));
    expect(saveResult).toEqual({ ok: true });

    // Read it back
    const progress = await page.evaluate(() => (window as any).__getProgress());
    expect(progress).toEqual({ level: 5, score: 500 });

    // Disconnect
    await page.evaluate(() => (window as any).__disconnect());
    await page.waitForFunction(() => (window as any).__getConnectionState() !== 'connected');

    // Reconnect as the same user
    await page.evaluate(() =>
      (window as any).__connect({ auth: { headers: { 'x-user-id': 'session-user-1' } } }),
    );
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    // Progress should persist
    const restored = await page.evaluate(() => (window as any).__getProgress());
    expect(restored).toEqual({ level: 5, score: 500 });

    await saveScreenshot(page, 'tutorial-8-sessions');
    await page.evaluate(() => (window as any).__disconnect());
  });
});
