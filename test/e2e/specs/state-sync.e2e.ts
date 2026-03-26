import { test, expect } from '@playwright/test';

import { TestState } from '../../helpers/test-contract';
import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('State Sync', () => {
  test('receives state patches from server', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => window.__connect());

    await snap(page, testInfo, 'state-sync-before');

    await page.evaluate((k) => window.__subscribeState(k), TestState.Counter);

    await harness.getDatasoleServer().localServer.setState(TestState.Counter, { value: 42 });

    await page.waitForFunction(() => window.__stateUpdates.length > 0, null, {
      timeout: 5000,
    });

    const updates = await page.evaluate(() => window.__stateUpdates);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0]!.key).toBe(TestState.Counter);

    await snap(page, testInfo, 'state-sync-after');

    await page.evaluate(() => window.__disconnect());
  });
});
