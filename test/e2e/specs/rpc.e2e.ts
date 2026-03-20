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

test.describe('RPC', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#status')).toHaveText('ready');
    await page.evaluate(() => (window as any).__connect());
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => (window as any).__disconnect());
  });

  test('echo RPC returns params', async ({ page }, testInfo) => {
    const logs = captureConsoleLogs(page);
    const result = await page.evaluate(() => (window as any).__rpc('echo', { hello: 'world' }));
    expect(result).toEqual({ hello: 'world' });
    expect(hasErrors(logs)).toBe(false);

    await snap(page, testInfo, 'rpc-echo');
  });

  test('add RPC returns computed sum', async ({ page }, testInfo) => {
    const result = await page.evaluate(() => (window as any).__rpc('add', { a: 3, b: 7 }));
    expect(result).toEqual({ sum: 10 });

    await snap(page, testInfo, 'rpc-add');
  });

  test('concurrent RPC calls', async ({ page }, testInfo) => {
    const results = await page.evaluate(async () => {
      const w = window as any;
      const [r1, r2, r3] = await Promise.all([
        w.__rpc('echo', { n: 1 }),
        w.__rpc('add', { a: 10, b: 20 }),
        w.__rpc('echo', { n: 3 }),
      ]);
      return [r1, r2, r3];
    });
    expect(results[0]).toEqual({ n: 1 });
    expect(results[1]).toEqual({ sum: 30 });
    expect(results[2]).toEqual({ n: 3 });

    await snap(page, testInfo, 'rpc-concurrent');
  });

  test('error RPC rejects', async ({ page }, testInfo) => {
    const error = await page.evaluate(async () => {
      try {
        await (window as any).__rpc('error');
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(error).toContain('Intentional test error');

    await snap(page, testInfo, 'rpc-error');
  });
});
