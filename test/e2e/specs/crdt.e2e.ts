import { test, expect } from '@playwright/test';

import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

test.describe('CRDT', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('PN counter increments and syncs via server', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    await page.evaluate(() => window.__initCrdt('e2e-client'));

    const val1 = await page.evaluate(() => window.__crdtIncrement());
    expect(val1).toBe(1);

    await snap(page, testInfo, 'crdt-increment-1');

    const val2 = await page.evaluate(() => window.__crdtIncrement());
    expect(val2).toBe(2);

    const val3 = await page.evaluate(() => window.__crdtIncrement());
    expect(val3).toBe(3);

    await page.waitForFunction(() => window.__crdtValues.counter >= 3, null, {
      timeout: 5000,
    });

    const serverSynced = await page.evaluate(() => window.__crdtValues.counter);
    expect(serverSynced).toBeGreaterThanOrEqual(3);

    await snap(page, testInfo, 'crdt-synced');

    await page.evaluate(() => window.__disconnect());
  });

  test('PN counter decrements', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    await page.evaluate(() => window.__initCrdt('e2e-client-2'));

    await page.evaluate(() => window.__crdtIncrement());
    await page.evaluate(() => window.__crdtIncrement());
    const afterDec = await page.evaluate(() => window.__crdtDecrement());
    expect(afterDec).toBe(1);

    await snap(page, testInfo, 'crdt-decrement');

    await page.evaluate(() => window.__disconnect());
  });
});
