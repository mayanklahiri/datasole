/**
 * Benchmark utilities for e2e performance testing.
 * Runs timed load scenarios in the browser and collects throughput/latency stats.
 */
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

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
): Promise<BenchScenarioResult> {
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

  return computeStats(name, result.latencies, durationSec * 1000, result.errors);
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
): Promise<BenchScenarioResult> {
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

  return {
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
  };
}

export function saveBenchResults(results: BenchSuiteResult): void {
  const dir = path.resolve(__dirname, '../reports/perf');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'benchmark-results.json'), JSON.stringify(results, null, 2));
}
