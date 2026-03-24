/**
 * Benchmark utilities for e2e performance testing.
 * Runs timed load scenarios in the browser and collects throughput/latency stats.
 */
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

export interface MainThreadMetrics {
  /** Number of Long Tasks (>50 ms) observed during the benchmark. */
  longTaskCount: number;
  /** Total time spent in Long Tasks (ms). */
  longTaskTotalMs: number;
  /** Max single Long Task duration (ms). */
  longTaskMaxMs: number;
  /** Median rAF inter-frame gap (ms); ideal ≈ 16.67. */
  rafMedianMs: number;
  /** 99th percentile rAF inter-frame gap (ms). */
  rafP99Ms: number;
  /** Number of rAF frames that exceeded 50 ms gap ("janky frames"). */
  rafJankFrames: number;
  /** Number of rAF frames that exceeded 33 ms gap ("dropped frames"). */
  rafDroppedFrames: number;
  /** Total rAF frames measured. */
  rafTotalFrames: number;
}

export interface ConsoleMetrics {
  /** Number of console.error() calls observed during the benchmark. */
  consoleErrors: number;
  /** Number of console.warn() calls observed during the benchmark. */
  consoleWarnings: number;
}

export interface BenchScenarioResult {
  name: string;
  durationMs: number;
  totalOps: number;
  opsPerSec: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  errors: number;
  /** Browser console error and warning counts during the benchmark. */
  console: ConsoleMetrics;
  /** Main-thread blocking metrics (present when measurement is enabled). */
  mainThread?: MainThreadMetrics;
}

export interface BenchSuiteResult {
  timestamp: string;
  scenarios: BenchScenarioResult[];
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeStats(
  name: string,
  latencies: number[],
  durationMs: number,
  errors: number,
): BenchScenarioResult {
  const sorted = latencies.slice().sort((a, b) => a - b);
  const totalOps = sorted.length;
  return {
    name,
    durationMs,
    totalOps,
    opsPerSec: Math.round((totalOps / durationMs) * 1000),
    p50Ms: Math.round(percentile(sorted, 50) * 100) / 100,
    p95Ms: Math.round(percentile(sorted, 95) * 100) / 100,
    p99Ms: Math.round(percentile(sorted, 99) * 100) / 100,
    minMs: sorted.length > 0 ? Math.round(sorted[0] * 100) / 100 : 0,
    maxMs: sorted.length > 0 ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0,
    errors,
    console: { consoleErrors: 0, consoleWarnings: 0 },
  };
}

/**
 * Inject Long Tasks + rAF observers into the page. Call before starting a workload.
 * Returns a stop handle that collects and returns MainThreadMetrics.
 */
export async function startMainThreadMetrics(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Record<string, unknown>;
    w.__mtLongTasks = [] as { duration: number }[];
    w.__mtRafGaps = [] as number[];
    w.__mtRafRunning = true;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        (w.__mtLongTasks as { duration: number }[]).push({ duration: entry.duration });
      }
    });
    obs.observe({ type: 'longtask', buffered: false });
    w.__mtObserver = obs;

    let last = performance.now();
    function rafLoop() {
      const now = performance.now();
      (w.__mtRafGaps as number[]).push(now - last);
      last = now;
      if (w.__mtRafRunning) requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);
  });
}

export async function collectMainThreadMetrics(page: Page): Promise<MainThreadMetrics> {
  return page.evaluate(() => {
    const w = window as Record<string, unknown>;
    w.__mtRafRunning = false;
    const obs = w.__mtObserver as PerformanceObserver | undefined;
    if (obs) obs.disconnect();

    const longTasks = (w.__mtLongTasks ?? []) as { duration: number }[];
    const rafGaps = (w.__mtRafGaps ?? []) as number[];
    const sorted = rafGaps.slice().sort((a, b) => a - b);

    function pctl(arr: number[], p: number): number {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    }

    return {
      longTaskCount: longTasks.length,
      longTaskTotalMs: Math.round(longTasks.reduce((s, t) => s + t.duration, 0) * 100) / 100,
      longTaskMaxMs:
        longTasks.length > 0
          ? Math.round(Math.max(...longTasks.map((t) => t.duration)) * 100) / 100
          : 0,
      rafMedianMs: Math.round(pctl(sorted, 50) * 100) / 100,
      rafP99Ms: Math.round(pctl(sorted, 99) * 100) / 100,
      rafJankFrames: rafGaps.filter((g) => g > 50).length,
      rafDroppedFrames: rafGaps.filter((g) => g > 33).length,
      rafTotalFrames: rafGaps.length,
    };
  });
}

interface ConsoleCollector {
  collect(): ConsoleMetrics;
}

/**
 * Attach a listener that counts console errors and warnings on the page.
 * Call `.collect()` after the benchmark to get the totals and detach.
 */
function startConsoleMetrics(page: Page): ConsoleCollector {
  let errors = 0;
  let warnings = 0;
  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    const t = msg.type();
    if (t === 'error') errors++;
    else if (t === 'warning') warnings++;
  };
  page.on('console', handler);
  return {
    collect(): ConsoleMetrics {
      page.off('console', handler);
      return { consoleErrors: errors, consoleWarnings: warnings };
    },
  };
}

/**
 * Run a benchmark scenario inside the browser page via page.evaluate.
 * The `fn` string is injected as an async function body that has access to
 * `window.__client` (DatasoleClient) and must return `{ latencies: number[], errors: number }`.
 */
export async function runBench(
  page: Page,
  name: string,
  durationSec: number,
  setupFn: string,
  benchFn: string,
  measureMainThread = false,
): Promise<BenchScenarioResult> {
  const consoleMon = startConsoleMetrics(page);
  if (measureMainThread) await startMainThreadMetrics(page);

  const result = await page.evaluate(
    async ({ setupCode, benchCode, durationMs }) => {
      const setupFunc = new Function(
        `return (async () => { ${setupCode} })()`,
      ) as () => Promise<void>;
      await setupFunc();

      const benchFunc = new Function(
        'deadline',
        `return (async (deadline) => { ${benchCode} })(deadline)`,
      ) as (deadline: number) => Promise<{ latencies: number[]; errors: number }>;

      const deadline = performance.now() + durationMs;
      return benchFunc(deadline);
    },
    { setupCode: setupFn, benchCode: benchFn, durationMs: durationSec * 1000 },
  );

  const stats = computeStats(name, result.latencies, durationSec * 1000, result.errors);
  stats.console = consoleMon.collect();
  if (measureMainThread) {
    stats.mainThread = await collectMainThreadMetrics(page);
  }
  return stats;
}

/**
 * Run a receive-rate benchmark: the server pushes data and the client counts received items.
 */
export async function runReceiveBench(
  page: Page,
  name: string,
  durationSec: number,
  triggerRpc: string,
  countExpr: string,
  measureMainThread = false,
): Promise<BenchScenarioResult> {
  const consoleMon = startConsoleMetrics(page);
  if (measureMainThread) await startMainThreadMetrics(page);

  const result = await page.evaluate(
    async ({ trigger, countCode, durationMs }) => {
      const triggerFn = new Function(
        `return (async () => { ${trigger} })()`,
      ) as () => Promise<void>;
      await triggerFn();
      await new Promise((r) => setTimeout(r, durationMs));
      const countFn = new Function(`return (${countCode})`) as () => number;
      return { count: countFn(), durationMs };
    },
    { trigger: triggerRpc, countCode: countExpr, durationMs: durationSec * 1000 },
  );

  const stats: BenchScenarioResult = {
    name,
    durationMs: result.durationMs,
    totalOps: result.count,
    opsPerSec: Math.round((result.count / result.durationMs) * 1000),
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    minMs: 0,
    maxMs: 0,
    errors: 0,
    console: consoleMon.collect(),
  };

  if (measureMainThread) {
    stats.mainThread = await collectMainThreadMetrics(page);
  }
  return stats;
}

export function saveBenchResults(results: BenchSuiteResult): void {
  const dir = path.resolve(__dirname, '../reports/perf');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'benchmark-results.json'), JSON.stringify(results, null, 2));
}
