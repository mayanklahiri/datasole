import { test, expect, type Browser, type Page } from '@playwright/test';

import { snap } from '../../helpers/screenshots';
import { DemoHarness } from '../../helpers/demo-harness';

const harness = new DemoHarness('react-express');
const CONNECTION_TIMEOUT_MS = 45_000;
const UI_SETTLE_TIMEOUT_MS = 20_000;

async function withFreshDemoPage<T>(browser: Browser, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await context.close();
  }
}

async function waitForDemoConnected(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('.conn-badge span:last-child').textContent(), {
      timeout: CONNECTION_TIMEOUT_MS,
    })
    .toBe('connected');
}

test.beforeAll(async () => {
  harness.prepare();
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('React + Express Demo', () => {
  // One browser session: a second cold `goto` right after the first test's WS teardown can stay in
  // `reconnecting` until reconnect backoff ends (server or client race on port 4001).
  test('dashboard: load, metrics, chat, and RPC in one session', async ({ browser }, testInfo) => {
    await withFreshDemoPage(browser, async (page) => {
      await page.goto(harness.getUrl());

      await expect(page.locator('header h1')).toHaveText('datasole');
      await snap(page, testInfo, 'demo-react-express-initial');

      await waitForDemoConnected(page);
      await snap(page, testInfo, 'demo-react-express-connected');

      await expect(page.locator('.metrics-grid')).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });
      await expect(page.locator('.metric-card')).toHaveCount(8);
      await snap(page, testInfo, 'demo-react-express-metrics');

      const chatInput = page.locator('.chat-input-bar input');
      const message = `Hello from React e2e! ${Date.now()}`;
      await chatInput.click();
      await chatInput.fill(message);
      await expect(chatInput).toHaveValue(message);
      await page.locator('.chat-input-bar .btn').click();
      await expect(chatInput).toHaveValue('', { timeout: 5000 });
      await expect(page.locator('.chat-panel .msg-count')).toHaveText('1', {
        timeout: UI_SETTLE_TIMEOUT_MS,
      });
      await expect(page.locator('.chat-messages .chat-msg .body').first()).toContainText(
        'Hello from React e2e!',
        { timeout: 5000 },
      );
      await snap(page, testInfo, 'demo-react-express-chat');

      const minInput = page.locator('.rpc-row input[type="number"]').first();
      const maxInput = page.locator('.rpc-row input[type="number"]').last();
      await minInput.fill('10');
      await maxInput.fill('20');
      await page.locator('.rpc-controls .btn').click();
      await expect(page.locator('.rpc-result-value')).toBeVisible({
        timeout: UI_SETTLE_TIMEOUT_MS,
      });
      const value = parseInt((await page.locator('.rpc-result-value').textContent()) || '0', 10);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(20);
      await snap(page, testInfo, 'demo-react-express-rpc');
    });
  });
});
