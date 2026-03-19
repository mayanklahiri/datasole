import { test, expect } from '@playwright/test';

import { ServerHarness } from '../helpers/server-harness';

const harness = new ServerHarness();

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('Auth', () => {
  test('connects with valid auth token', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const state = await page.evaluate(() =>
      (window as any).__connect({ auth: { token: 'valid-token' } }),
    );
    expect(state).toBe('connected');
    await page.evaluate(() => (window as any).__disconnect());
  });

  test('rejects connection with invalid token', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const error = await page.evaluate(async () => {
      try {
        await (window as any).__connect({ auth: { token: 'reject' } });
        return null;
      } catch (e: any) {
        return e.message || 'connection failed';
      }
    });
    expect(error).toBeTruthy();
  });

  test('connects without token (anonymous allowed)', async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');

    const state = await page.evaluate(() => (window as any).__connect());
    expect(state).toBe('connected');
    await page.evaluate(() => (window as any).__disconnect());
  });
});
