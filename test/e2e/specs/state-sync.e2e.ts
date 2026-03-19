import { test, expect } from '@playwright/test';

import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('State Sync', () => {
  test('receives state patches from server', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => (window as any).__connect());
    await page.evaluate(() => (window as any).__subscribeState('counter'));

    // Set state on the server, which should broadcast to clients
    await harness.getDatasoleServer().setState('counter', { value: 42 });

    // Wait for patch to arrive
    await page.waitForFunction(() => (window as any).__stateUpdates.length > 0, null, {
      timeout: 5000,
    });

    const updates = await page.evaluate(() => (window as any).__stateUpdates);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].key).toBe('counter');

    await page.evaluate(() => (window as any).__disconnect());
  });
});
