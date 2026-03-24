/**
 * End-to-end performance benchmarks. Runs each datasole scenario for a fixed
 * duration against a live server with a headless Chromium client.
 */
import { expect, test } from '@playwright/test';

import {
  collectSystemInfo,
  runBench,
  runReceiveBench,
  saveBenchResults,
} from '../helpers/bench-utils';
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
    system: collectSystemInfo(),
    scenarios: results,
  };
  saveBenchResults(suite);
  await harness.stop();
});

async function setupPage(page: import('@playwright/test').Page) {
  await page.goto(harness.getUrl());
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 5000 });
  await page.evaluate(() => window.__connect());
  await page.waitForFunction(() => window.__getConnectionState() === 'connected', undefined, {
    timeout: 5000,
  });
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

  test('binary frame streaming (1 KB frames)', async ({ page }) => {
    await setupPage(page);

    const result = await runReceiveBench(
      page,
      'binary-frame-1kb',
      BENCH_DURATION_SEC,
      `
      window.__benchBinaryCount = 0;
      window.__benchBinaryBytes = 0;
      window.__client.on('bench:binary-frame', function(ev) {
        window.__benchBinaryCount++;
        window.__benchBinaryBytes += ev.data.size;
      });
      await window.__rpc('startBinaryFrameFlood', { durationMs: ${BENCH_DURATION_SEC * 1000}, frameSizeBytes: 1024 });
      `,
      'window.__benchBinaryCount',
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('RPC small payload (under compression threshold)', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'rpc-small-payload',
      BENCH_DURATION_SEC,
      '',
      `
      var latencies = [];
      var errors = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          await window.__rpc('echo', { x: 42, y: 'hi' });
          latencies.push(performance.now() - t0);
        } catch { errors++; }
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('RPC large JSON payload (over compression threshold)', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'rpc-large-json',
      BENCH_DURATION_SEC,
      '',
      `
      var latencies = [];
      var errors = 0;
      function makePayload() {
        var items = [];
        for (var i = 0; i < 20; i++) {
          items.push({
            id: 'item-' + Math.random().toString(36).slice(2),
            value: Math.random() * 1000,
            tags: ['alpha', 'beta', 'gamma'].slice(0, 1 + (Math.random() * 3 | 0)),
            ts: Date.now(),
            nested: { a: Math.random(), b: Math.random().toString(36) }
          });
        }
        return { items: items, meta: { page: 1, total: 100 } };
      }
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          await window.__rpc('echoLargeJson', { payload: makePayload() });
          latencies.push(performance.now() - t0);
        } catch { errors++; }
      }
      return { latencies: latencies, errors: errors };
      `,
    );

    results.push(result);
    expect(result.totalOps).toBeGreaterThan(0);
  });

  test('two-way low-latency emit (game tick / trade confirm)', async ({ page }) => {
    await setupPage(page);

    const result = await runBench(
      page,
      'two-way-latency',
      BENCH_DURATION_SEC,
      `
      window.__benchAckCount = 0;
      window.__client.on('bench:game-state', function() { window.__benchAckCount++; });
      `,
      `
      var latencies = [];
      var errors = 0;
      var seq = 0;
      while (performance.now() < deadline) {
        var t0 = performance.now();
        try {
          var ackBefore = window.__benchAckCount;
          window.__client.emit('bench:game-tick', { seq: seq++, ts: Date.now(), dx: 1, dy: -1 });
          // Wait for server ack (poll with microtask yield)
          var waited = 0;
          while (window.__benchAckCount === ackBefore && waited < 100) {
            await new Promise(function(r) { setTimeout(r, 0); });
            waited++;
          }
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

  /**
   * Main-thread blocking comparison: worker vs no-worker under identical flood workloads.
   * Uses Long Tasks API + rAF jitter to quantify the difference.
   * CPU is throttled 4× via CDP to simulate mobile/constrained devices where
   * the off-main-thread benefit is most pronounced.
   */
  for (const useWorker of [true, false]) {
    const tag = useWorker ? 'worker' : 'no-worker';

    async function setupWithMode(pg: import('@playwright/test').Page) {
      const cdp = await pg.context().newCDPSession(pg);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      await pg.goto(harness.getUrl());
      await expect(pg.locator('#status')).toHaveText('ready', { timeout: 10000 });
      await pg.evaluate((opts) => window.__connect(opts), { useWorker });
      await pg.waitForFunction(() => window.__getConnectionState() === 'connected', undefined, {
        timeout: 10000,
      });
    }

    test(`main-thread: heavy payload flood (${tag})`, async ({ page }) => {
      await setupWithMode(page);

      const result = await runReceiveBench(
        page,
        `main-thread-heavy-flood-${tag}`,
        BENCH_DURATION_SEC,
        `
        window.__benchHeavyCount = 0;
        window.__client.on('bench:heavy-payload', function(ev) {
          window.__benchHeavyCount++;
          var el = document.getElementById('vis-log');
          if (el) el.setAttribute('data-bench', String(window.__benchHeavyCount));
        });
        await window.__rpc('startHeavyPayloadFlood', { durationMs: ${BENCH_DURATION_SEC * 1000}, payloadSizeKb: 5 });
        `,
        'window.__benchHeavyCount',
        true,
      );

      results.push(result);
      expect(result.totalOps).toBeGreaterThan(0);
      expect(result.mainThread).toBeTruthy();
    });

    test(`main-thread: event flood (${tag})`, async ({ page }) => {
      await setupWithMode(page);

      const result = await runReceiveBench(
        page,
        `main-thread-event-flood-${tag}`,
        BENCH_DURATION_SEC,
        `
        window.__benchEventCount = 0;
        window.__client.on('bench:event', function() { window.__benchEventCount++; });
        await window.__rpc('startBroadcastFlood', { durationMs: ${BENCH_DURATION_SEC * 1000} });
        `,
        'window.__benchEventCount',
        true,
      );

      results.push(result);
      expect(result.totalOps).toBeGreaterThan(0);
      expect(result.mainThread).toBeTruthy();
    });

    test(`main-thread: RPC echo (${tag})`, async ({ page }) => {
      await setupWithMode(page);

      const result = await runBench(
        page,
        `main-thread-rpc-echo-${tag}`,
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
        true,
      );

      results.push(result);
      expect(result.totalOps).toBeGreaterThan(0);
      expect(result.mainThread).toBeTruthy();
    });
  }
});
