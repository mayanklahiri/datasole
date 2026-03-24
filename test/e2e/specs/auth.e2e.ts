import { test, expect } from '@playwright/test';

import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('Auth', () => {
  test('connects with valid auth token', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const state = await page.evaluate(() => window.__connect({ auth: { token: 'valid-token' } }));
    expect(state).toBe('connected');

    await snap(page, testInfo, 'auth-valid-token');

    await page.evaluate(() => window.__disconnect());
  });

  test('rejects connection with invalid token', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const error = await page.evaluate(async () => {
      try {
        await window.__connect({ auth: { token: 'reject' } });
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message || 'connection failed' : String(e);
      }
    });
    expect(error).toBeTruthy();

    await snap(page, testInfo, 'auth-rejected');
  });

  test('connects without token (anonymous allowed)', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const state = await page.evaluate(() => window.__connect());
    expect(state).toBe('connected');

    await snap(page, testInfo, 'auth-anonymous');

    await page.evaluate(() => window.__disconnect());
  });
});
