/**
 * Collects Playwright performance measures from the page and writes them as JSON under `reports/perf/`.
 */
import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export interface PerfEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

export async function collectPerfMetrics(page: Page): Promise<PerfEntry[]> {
  return page.evaluate(() => {
    return performance.getEntriesByType('measure').map((e) => ({
      name: e.name,
      entryType: e.entryType,
      startTime: e.startTime,
      duration: e.duration,
    }));
  });
}

export function savePerfMetrics(testName: string, metrics: PerfEntry[]): void {
  const dir = path.resolve(__dirname, '../reports/perf');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${testName}.json`), JSON.stringify(metrics, null, 2));
}
