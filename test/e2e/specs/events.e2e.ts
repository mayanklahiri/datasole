import { test, expect } from '@playwright/test';

import { captureConsoleLogs, hasErrors } from '../helpers/console-capture';
import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('Events', () => {
  test('receives server broadcast events', async ({ page }, testInfo) => {
    const logs = captureConsoleLogs(page);
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => window.__connect());
    await page.evaluate(() => window.__subscribeEvent('server-pong'));

    await page.waitForTimeout(200);

    harness.getDatasoleServer().localServer.broadcast('server-pong', { echo: 'hello from server' });

    await page.waitForFunction(() => window.__events.length > 0, null, { timeout: 5000 });

    const events = await page.evaluate(() => window.__events);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].data).toEqual({ echo: 'hello from server' });
    expect(hasErrors(logs)).toBe(false);

    await snap(page, testInfo, 'events-server-broadcast');

    await page.evaluate(() => window.__disconnect());
  });

  test('client sends event to server', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => window.__connect());
    await page.evaluate(() => window.__subscribeEvent('server-pong'));

    await page.waitForTimeout(200);

    await page.evaluate(() => window.__emitEvent('client-ping', { message: 'ping!' }));

    await page.waitForFunction(() => window.__events.length > 0, null, { timeout: 5000 });

    const events = await page.evaluate(() => window.__events);
    expect(events.length).toBeGreaterThan(0);

    await snap(page, testInfo, 'events-client-send');

    await page.evaluate(() => window.__disconnect());
  });
});
