import { test, expect } from '@playwright/test';

import { captureConsoleLogs, hasErrors } from '../helpers/console-capture';
import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('Events', () => {
  test('receives server broadcast events', async ({ page }) => {
    const logs = captureConsoleLogs(page);
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => (window as any).__connect());
    await page.evaluate(() => (window as any).__subscribeEvent('server-pong'));

    // Give client time to register
    await page.waitForTimeout(200);

    // Server broadcasts an event
    harness.getDatasoleServer().broadcast('server-pong', { msg: 'hello from server' });

    // Wait for event to arrive
    await page.waitForFunction(() => (window as any).__events.length > 0, null, { timeout: 5000 });

    const events = await page.evaluate(() => (window as any).__events);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].data).toEqual({ msg: 'hello from server' });
    expect(hasErrors(logs)).toBe(false);

    await page.evaluate(() => (window as any).__disconnect());
  });

  test('client sends event to server', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => (window as any).__connect());
    await page.evaluate(() => (window as any).__subscribeEvent('server-pong'));

    await page.waitForTimeout(200);

    // Client sends event to server, server echoes back as broadcast
    await page.evaluate(() => (window as any).__emitEvent('client-ping', { message: 'ping!' }));

    await page.waitForFunction(() => (window as any).__events.length > 0, null, { timeout: 5000 });

    const events = await page.evaluate(() => (window as any).__events);
    expect(events.length).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).__disconnect());
  });
});
