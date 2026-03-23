import { test, expect } from '@playwright/test';

import { snap } from '../../helpers/screenshots';
import { DemoHarness } from '../../helpers/demo-harness';

const harness = new DemoHarness('vanilla');

test.beforeAll(async () => {
  harness.prepare();
  await harness.start();
});

test.afterAll(async () => {
  await harness.stop();
});

test.describe('Vanilla Demo', () => {
  test('loads and connects', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());

    await expect(page.locator('header h1')).toHaveText('datasole');
    await snap(page, testInfo, 'demo-vanilla-initial');

    // Wait for WebSocket connection
    await expect(page.locator('#conn-label')).toHaveText('connected', { timeout: 5000 });
    await snap(page, testInfo, 'demo-vanilla-connected');
  });

  test('receives live metrics within 5 seconds', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#conn-label')).toHaveText('connected', { timeout: 5000 });

    // Wait for metrics grid to appear (replaces "Waiting for metrics…")
    await expect(page.locator('.metrics-grid')).toBeVisible({ timeout: 5000 });

    // Verify metric cards have content
    const cards = page.locator('.metric-card');
    await expect(cards).toHaveCount(6);

    await snap(page, testInfo, 'demo-vanilla-metrics');
  });

  test('chat sends and displays messages', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#conn-label')).toHaveText('connected', { timeout: 5000 });

    await page.fill('#chat-input', 'Hello from e2e test!');
    await page.click('#chat-send');

    await expect(page.locator('.chat-msg')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.chat-msg .body').first()).toHaveText('Hello from e2e test!');

    await snap(page, testInfo, 'demo-vanilla-chat');
  });

  test('RPC generates random number', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await expect(page.locator('#conn-label')).toHaveText('connected', { timeout: 5000 });

    await page.fill('#rpc-min', '10');
    await page.fill('#rpc-max', '20');
    await page.click('#rpc-call');

    await expect(page.locator('.rpc-result-value')).toBeVisible({ timeout: 5000 });

    const value = parseInt((await page.locator('.rpc-result-value').textContent()) || '0', 10);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);

    await snap(page, testInfo, 'demo-vanilla-rpc');
  });
});
