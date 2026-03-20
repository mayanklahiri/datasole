/**
 * End-to-end performance benchmarks. Runs each datasole scenario for a fixed
 * duration against a live server with a headless Chromium client.
 */
import { expect, test } from '@playwright/test';

import { runBench, runReceiveBench, saveBenchResults } from '../helpers/bench-utils';
import type { BenchScenarioResult, BenchSuiteResult } from '../helpers/bench-utils';
import { ServerHarness } from '../helpers/server-harness';

test.use({ viewport: { width: 1280, height: 720 } });

const BENCH_DURATION_SEC = 3;
const harness = new ServerHarness();
const results: BenchScenarioResult[] = [];

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(async () => {
  const suite: BenchSuiteResult = {
    timestamp: new Date().toISOString(),
    scenarios: results,
  };
  saveBenchResults(suite);
  await harness.stop();
});

async function setupPage(page: import('@playwright/test').Page) {
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 5000 });
  await page.evaluate(() => (window as Record<string, unknown>).__connect());
  await page.waitForFunction(
    () => (window as Record<string, unknown>).__getConnectionState?.() === 'connected',
    undefined,
    { timeout: 5000 },
  );
}

test.describe('Benchmarks', { tag: '@bench' }, () => {
  test.describe.configure({ timeout: 60000 });
  test('RPC echo latency', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'rpc-echo',
      BENCH_DURATION_SEC,
      '',
      `
      var latencies = [];
      var errors = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          await window.__rpc('echo', { ts: Date.now() });
          latencies.push(performance.now() - t0);
        } catch { errors++; }
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('RPC concurrent throughput', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'rpc-concurrent',
      BENCH_DURATION_SEC,
      '',
      `
      var latencies = [];
      var errors = 0;
      var BATCH = 10;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        var promises = [];
        for (var i = 0; i < BATCH; i++) {
          promises.push(window.__rpc('echo', { i: i }).catch(function() { errors++; }));
        }
        await Promise.all(promises);
        var elapsed = performance.now() - t0;
        for (var j = 0; j < BATCH; j++) latencies.push(elapsed / BATCH);
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('server event receive rate', async ({ page }) => {
    await setupPage(page);

    const result = await runReceiveBench(
      page,
      'server-event-receive',
      BENCH_DURATION_SEC,
      `
      window.__benchEventCount = 0;
      window.__client.on('bench:event', function() { window.__benchEventCount++; });
      await window.__rpc('startBroadcastFlood', { durationMs: ${BENCH_DURATION_SEC * 1000} });
      `,
      'window.__benchEventCount',
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('live state sync rate', async ({ page }) => {
    await setupPage(page);

    const result = await runReceiveBench(
      page,
      'state-sync-receive',
      BENCH_DURATION_SEC,
      `
      window.__benchPatchCount = 0;
      window.__client.subscribeState('benchState', function() { window.__benchPatchCount++; });
      await window.__rpc('startStateMutationFlood', { durationMs: ${BENCH_DURATION_SEC * 1000} });
      `,
      'window.__benchPatchCount',
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('client event emit throughput', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'client-event-emit',
      BENCH_DURATION_SEC,
      '',
      `
      var latencies = [];
      var errors = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          window.__client.emit('client-ping', { ts: Date.now() });
          latencies.push(performance.now() - t0);
        } catch { errors++; }
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('CRDT increment throughput', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'crdt-increment',
      BENCH_DURATION_SEC,
      `window.__initCrdt('bench-node');`,
      `
      var latencies = [];
      var errors = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          window.__crdtIncrement();
          latencies.push(performance.now() - t0);
        } catch { errors++; }
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('mixed workload', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'mixed-workload',
      BENCH_DURATION_SEC,
      `
      window.__benchMixedEvents = 0;
      window.__client.on('server-pong', function() { window.__benchMixedEvents++; });
      window.__client.subscribeState('benchState', function() {});
      `,
      `
      var latencies = [];
      var errors = 0;
      var i = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          if (i % 3 === 0) {
            await window.__rpc('echo', { i: i });
          } else if (i % 3 === 1) {
            window.__client.emit('client-ping', { i: i });
          } else {
            await window.__rpc('add', { a: i, b: i + 1 });
          }
          latencies.push(performance.now() - t0);
        } catch { errors++; }
        i++;
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });
});
