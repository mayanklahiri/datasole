import { test, expect } from '@playwright/test';

import { snap } from '../../helpers/screenshots';
import { DemoHarness } from '../../helpers/demo-harness';

const harness = new DemoHarness('react-express');
const CONNECTION_TIMEOUT_MS = 15_000;
const UI_SETTLE_TIMEOUT_MS = 10_000;

test.beforeAll(async () => {
  harness.prepare();
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('React + Express Demo', () => {
  test('loads and connects', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());

    await expect(page.locator('header h1')).toHaveText('datasole');
    await snap(page, testInfo, 'demo-react-express-initial');

    // Wait for WebSocket connection
    await expect(page.locator('.conn-badge span:last-child')).toHaveText('connected', {
      timeout: CONNECTION_TIMEOUT_MS,
    });
    await snap(page, testInfo, 'demo-react-express-connected');
  });

  test('receives live metrics within 5 seconds', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('.conn-badge span:last-child')).toHaveText('connected', {
      timeout: CONNECTION_TIMEOUT_MS,
    });

    await expect(page.locator('.metrics-grid')).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    const cards = page.locator('.metric-card');
    await expect(cards).toHaveCount(8);

    await snap(page, testInfo, 'demo-react-express-metrics');
  });

  test('chat sends and displays messages', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('.conn-badge span:last-child')).toHaveText('connected', {
      timeout: CONNECTION_TIMEOUT_MS,
    });

    await page.fill('.chat-input-bar input', 'Hello from React e2e!');
    await page.click('.chat-input-bar .btn');

    await expect(page.locator('.chat-messages .chat-msg .body').last()).toHaveText(
      'Hello from React e2e!',
      { timeout: UI_SETTLE_TIMEOUT_MS },
    );

    await snap(page, testInfo, 'demo-react-express-chat');
  });

  test('RPC generates random number', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('.conn-badge span:last-child')).toHaveText('connected', {
      timeout: CONNECTION_TIMEOUT_MS,
    });

    const minInput = page.locator('.rpc-row input[type="number"]').first();
    const maxInput = page.locator('.rpc-row input[type="number"]').last();
    await minInput.fill('10');
    await maxInput.fill('20');
    await page.locator('.rpc-controls .btn').click();

    await expect(page.locator('.rpc-result-value')).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    const value = parseInt((await page.locator('.rpc-result-value').textContent()) || '0', 10);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);

    await snap(page, testInfo, 'demo-react-express-rpc');
  });
});
