import { test, expect } from '@playwright/test';

import { ServerHarness } from '../helpers/server-harness';
import { saveScreenshot } from '../helpers/screenshots';

test.describe('CRDT', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('PN counter increments and syncs via server', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => (window as any).__connect());
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    await page.evaluate(() => (window as any).__initCrdt('e2e-client'));

    const val1 = await page.evaluate(() => (window as any).__crdtIncrement());
    expect(val1).toBe(1);

    const val2 = await page.evaluate(() => (window as any).__crdtIncrement());
    expect(val2).toBe(2);

    const val3 = await page.evaluate(() => (window as any).__crdtIncrement());
    expect(val3).toBe(3);

    // Wait for server broadcast to arrive
    await page.waitForFunction(() => (window as any).__crdtValues.counter >= 3, null, {
      timeout: 5000,
    });

    const serverSynced = await page.evaluate(() => (window as any).__crdtValues.counter);
    expect(serverSynced).toBeGreaterThanOrEqual(3);

    await saveScreenshot(page, 'tutorial-6-crdt');
    await page.evaluate(() => (window as any).__disconnect());
  });

  test('PN counter decrements', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => (window as any).__connect());
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    await page.evaluate(() => (window as any).__initCrdt('e2e-client-2'));

    await page.evaluate(() => (window as any).__crdtIncrement());
    await page.evaluate(() => (window as any).__crdtIncrement());
    const afterDec = await page.evaluate(() => (window as any).__crdtDecrement());
    expect(afterDec).toBe(1);

    await page.evaluate(() => (window as any).__disconnect());
  });
});
